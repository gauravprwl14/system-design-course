# AWS Auto-Scaling Groups (ASG)

## Question
**"Explain AWS Auto-Scaling Groups. How do they work? What scaling policies would you use for different scenarios?"**

Common in: AWS, DevOps, Cloud Architecture interviews

---

## 📊 Quick Answer

**Auto-Scaling Group (ASG)** = Automatically adjusts the number of EC2 instances based on demand

**Key Concepts**:
- **Desired Capacity**: Target number of instances
- **Min/Max**: Boundaries for scaling
- **Scaling Policies**: Rules that trigger scaling actions
- **Health Checks**: Replace unhealthy instances automatically

**Common Scaling Policies**:
1. **Target Tracking**: Maintain CPU at 50% (most common)
2. **Step Scaling**: Add 2 instances if CPU > 70%, add 4 if CPU > 90%
3. **Scheduled Scaling**: Scale up M-F 9am, scale down 6pm
4. **Predictive Scaling**: ML-based forecasting

---

## 🎯 Complete Solution

### 1. Basic ASG Setup (Terraform)

```hcl
# auto-scaling-group.tf

# Launch Template (defines instance configuration)
resource "aws_launch_template" "api" {
  name_prefix   = "api-server-"
  image_id      = "ami-0c55b159cbfafe1f0"  # Amazon Linux 2
  instance_type = "t3.medium"

  # User data (startup script)
  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    yum install -y nodejs
    cd /home/ec2-user
    git clone https://github.com/mycompany/api-server.git
    cd api-server
    npm install
    npm start
  EOF
  )

  # IAM role for EC2 instances
  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  # Security group
  vpc_security_group_ids = [aws_security_group.api_server.id]

  # Monitoring
  monitoring {
    enabled = true
  }

  # Tags
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "api-server"
      Environment = "production"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "api" {
  name                = "api-autoscaling-group"
  vpc_zone_identifier = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id,
    aws_subnet.private_c.id
  ]

  # Capacity
  min_size         = 2   # Minimum instances (high availability)
  max_size         = 10  # Maximum instances (cost control)
  desired_capacity = 3   # Target number of instances

  # Launch template
  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  # Health checks
  health_check_type         = "ELB"  # Use load balancer health check
  health_check_grace_period = 300    # Wait 5 min before first check

  # Load balancer
  target_group_arns = [aws_lb_target_group.api.arn]

  # Termination policies
  termination_policies = ["OldestInstance"]

  # Instance refresh (for rolling updates)
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 90
    }
  }

  # Tags
  tag {
    key                 = "Name"
    value               = "api-server"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = "production"
    propagate_at_launch = true
  }
}
```

---

### 2. Target Tracking Scaling Policy (Recommended)

```hcl
# target-tracking-policy.tf

# Policy: Maintain average CPU at 50%
resource "aws_autoscaling_policy" "cpu_target_tracking" {
  name                   = "cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }

    target_value = 50.0  # Keep CPU at 50%
  }
}

# Policy: Maintain request count per target
resource "aws_autoscaling_policy" "request_count_target_tracking" {
  name                   = "request-count-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label = "${aws_lb.api.arn_suffix}/${aws_lb_target_group.api.arn_suffix}"
    }

    target_value = 1000.0  # 1000 requests per instance per minute
  }
}

# How it works:
# - CPU at 40%: Do nothing (within target)
# - CPU at 60%: Add instances to bring average to 50%
# - CPU at 30%: Remove instances to bring average to 50%
```

---

### 3. Step Scaling Policy

```hcl
# step-scaling-policy.tf

# CloudWatch Alarm: High CPU
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"  # 2 consecutive periods
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "60"  # 1 minute
  statistic           = "Average"
  threshold           = "70"  # 70% CPU

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }

  alarm_actions = [aws_autoscaling_policy.scale_up.arn]
}

# CloudWatch Alarm: Low CPU
resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "api-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Average"
  threshold           = "30"  # 30% CPU

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }

  alarm_actions = [aws_autoscaling_policy.scale_down.arn]
}

# Scale Up Policy (Step Scaling)
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "scale-up"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "ChangeInCapacity"

  step_adjustment {
    scaling_adjustment          = 1   # Add 1 instance
    metric_interval_lower_bound = 0
    metric_interval_upper_bound = 10  # CPU 70-80%
  }

  step_adjustment {
    scaling_adjustment          = 2   # Add 2 instances
    metric_interval_lower_bound = 10
    metric_interval_upper_bound = 20  # CPU 80-90%
  }

  step_adjustment {
    scaling_adjustment          = 4   # Add 4 instances
    metric_interval_lower_bound = 20  # CPU > 90%
  }
}

# Scale Down Policy
resource "aws_autoscaling_policy" "scale_down" {
  name                   = "scale-down"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "ChangeInCapacity"

  step_adjustment {
    scaling_adjustment          = -1  # Remove 1 instance
    metric_interval_upper_bound = 0
  }
}
```

---

### 4. Scheduled Scaling

```hcl
# scheduled-scaling.tf

# Scale up for business hours (M-F 9am-6pm)
resource "aws_autoscaling_schedule" "business_hours_start" {
  scheduled_action_name  = "scale-up-business-hours"
  min_size               = 5
  max_size               = 20
  desired_capacity       = 10
  recurrence             = "0 9 * * 1-5"  # 9am Monday-Friday
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# Scale down after business hours
resource "aws_autoscaling_schedule" "business_hours_end" {
  scheduled_action_name  = "scale-down-after-hours"
  min_size               = 2
  max_size               = 10
  desired_capacity       = 3
  recurrence             = "0 18 * * 1-5"  # 6pm Monday-Friday
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# Scale down for weekends
resource "aws_autoscaling_schedule" "weekend" {
  scheduled_action_name  = "scale-down-weekend"
  min_size               = 1
  max_size               = 5
  desired_capacity       = 2
  recurrence             = "0 0 * * 0"  # Midnight Sunday
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# Cron format: minute hour day month day-of-week
# 0 9 * * 1-5 = 9:00 AM Monday-Friday
```

---

### 5. Predictive Scaling (ML-Based)

```hcl
# predictive-scaling.tf

resource "aws_autoscaling_policy" "predictive" {
  name                   = "predictive-scaling"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "PredictiveScaling"

  predictive_scaling_configuration {
    metric_specification {
      target_value = 50.0  # Target CPU 50%

      predefined_metric_pair_specification {
        predefined_metric_type = "ASGCPUUtilization"
      }
    }

    mode                         = "ForecastAndScale"  # Proactive scaling
    scheduling_buffer_time       = 600                 # 10 min buffer
    max_capacity_breach_behavior = "IncreaseMaxCapacity"
  }
}

# How it works:
# - Analyzes 14 days of historical data
# - Predicts traffic patterns (daily, weekly)
# - Scales BEFORE traffic spike hits
# - Example: Scales up at 8:50am for 9am spike
```

---

## 💻 Real-World Examples

### Example 1: E-commerce Flash Sale

```hcl
# flash-sale-asg.tf

# Flash sale at 8 PM - scale proactively
resource "aws_autoscaling_schedule" "flash_sale_prep" {
  scheduled_action_name  = "flash-sale-prep"
  min_size               = 20
  max_size               = 100
  desired_capacity       = 50
  start_time             = "2024-12-31T19:30:00Z"  # 30 min before
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# Scale down after flash sale
resource "aws_autoscaling_schedule" "flash_sale_end" {
  scheduled_action_name  = "flash-sale-end"
  min_size               = 5
  max_size               = 20
  desired_capacity       = 10
  start_time             = "2024-12-31T21:00:00Z"
  autoscaling_group_name = aws_autoscaling_group.api.name
}

# Aggressive step scaling during flash sale
resource "aws_autoscaling_policy" "flash_sale_scaling" {
  name                   = "flash-sale-aggressive-scaling"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "PercentChangeInCapacity"

  step_adjustment {
    scaling_adjustment          = 50  # Add 50% capacity
    metric_interval_lower_bound = 0
  }

  # Cooldown to prevent oscillation
  estimated_instance_warmup = 120  # 2 minutes
}
```

---

### Example 2: Multi-Metric Scaling

```javascript
// custom-metric-publisher.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

// Publish custom metric (active connections)
async function publishActiveConnections(count) {
  await cloudwatch.putMetricData({
    Namespace: 'MyApp/API',
    MetricData: [{
      MetricName: 'ActiveConnections',
      Value: count,
      Unit: 'Count',
      Timestamp: new Date()
    }]
  }).promise();
}

// Publish from application
setInterval(async () => {
  const activeConnections = getActiveWebSocketConnections();
  await publishActiveConnections(activeConnections);
}, 60000); // Every minute
```

```hcl
# Scale based on custom metric
resource "aws_autoscaling_policy" "custom_metric_scaling" {
  name                   = "active-connections-scaling"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    customized_metric_specification {
      metric_name = "ActiveConnections"
      namespace   = "MyApp/API"
      statistic   = "Average"
    }

    target_value = 1000.0  # 1000 connections per instance
  }
}
```

---

## 🔧 Best Practices

### 1. Cooldown Periods

```hcl
resource "aws_autoscaling_group" "api" {
  # ... other config ...

  # Default cooldown (simple scaling only)
  default_cooldown = 300  # 5 minutes

  # Prevents:
  # - Scaling up too quickly (wait for instances to start)
  # - Scaling down too aggressively (wait for metrics to stabilize)
}

resource "aws_autoscaling_policy" "scale_up" {
  # ... other config ...

  # Instance warmup (target tracking & step scaling)
  estimated_instance_warmup = 180  # 3 minutes

  # Time for instance to:
  # 1. Boot up
  # 2. Download code
  # 3. Start application
  # 4. Pass health checks
}
```

---

### 2. Health Checks

```hcl
resource "aws_autoscaling_group" "api" {
  # ... other config ...

  # ELB health check (recommended)
  health_check_type         = "ELB"
  health_check_grace_period = 300

  # EC2 health check (basic)
  # health_check_type = "EC2"  # Only checks if instance is running
}

# Application health check endpoint
# GET /health
# Response: 200 OK = healthy, anything else = unhealthy
```

```javascript
// health-check-endpoint.js
app.get('/health', async (req, res) => {
  try {
    // Check critical dependencies
    await db.query('SELECT 1');
    await redis.ping();

    res.status(200).json({ status: 'healthy' });
  } catch (err) {
    // ASG will replace this instance
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});
```

---

### 3. Termination Policies

```hcl
resource "aws_autoscaling_group" "api" {
  # ... other config ...

  # Choose which instances to terminate first
  termination_policies = [
    "OldestLaunchTemplate",  # Prefer older versions
    "OldestInstance",         # Then oldest instance
    "Default"                 # Then default (balanced AZs)
  ]

  # Available policies:
  # - OldestInstance: Terminate oldest first
  # - NewestInstance: Terminate newest first (for testing)
  # - OldestLaunchTemplate: Prefer instances with old launch template
  # - AllocationStrategy: Maintain spot/on-demand balance
  # - ClosestToNextInstanceHour: Save money (partial hours)
  # - Default: Maintain AZ balance
}
```

---

## 📊 Monitoring ASG

### CloudWatch Dashboard

```javascript
// create-dashboard.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function createASGDashboard(asgName) {
  await cloudwatch.putDashboard({
    DashboardName: `ASG-${asgName}`,
    DashboardBody: JSON.stringify({
      widgets: [
        {
          type: 'metric',
          properties: {
            metrics: [
              ['AWS/AutoScaling', 'GroupDesiredCapacity', { stat: 'Average' }],
              ['.', 'GroupInServiceInstances', { stat: 'Average' }],
              ['.', 'GroupMinSize', { stat: 'Average' }],
              ['.', 'GroupMaxSize', { stat: 'Average' }]
            ],
            period: 300,
            stat: 'Average',
            region: 'us-east-1',
            title: 'ASG Capacity',
            dimensions: {
              AutoScalingGroupName: asgName
            }
          }
        },
        {
          type: 'metric',
          properties: {
            metrics: [
              ['AWS/EC2', 'CPUUtilization', { stat: 'Average' }]
            ],
            period: 60,
            stat: 'Average',
            region: 'us-east-1',
            title: 'CPU Utilization',
            dimensions: {
              AutoScalingGroupName: asgName
            }
          }
        }
      ]
    })
  }).promise();
}
```

---

## 🎓 Interview Tips

### Common Questions

**Q: Target Tracking vs Step Scaling - which is better?**
A: "Target Tracking is recommended for most cases (simpler, automatic). Use Step Scaling when you need fine control over scaling speed (e.g., add 1 instance at 70% CPU, 2 at 80%, 4 at 90%)."

**Q: How does ASG determine which instance to terminate?**
A: "Follows termination policies in order. Default: 1) Balance across AZs, 2) Terminate instance with oldest launch template, 3) Terminate closest to next billing hour. Can customize with termination_policies parameter."

**Q: What happens during a deployment with ASG?**
A: "Use Instance Refresh for rolling deployment. ASG gradually replaces instances with new launch template version while maintaining min_healthy_percentage (e.g., 90%). Zero downtime if configured correctly."

**Q: How do you prevent scaling oscillation (flapping)?**
A: "Use cooldown periods and warmup times. Cooldown prevents rapid scaling. Warmup gives new instances time to stabilize before being considered for scaling decisions. Also use proper threshold values (e.g., 70% CPU instead of 50%)."

**Q: Can ASG scale across multiple regions?**
A: "No, ASG is regional. For multi-region, use Route 53 for DNS-based load balancing across regions, each with its own ASG."

---

## 🔗 Related Questions

- [Load Balancer (ALB/NLB)](/interview-prep/aws-cloud/load-balancer)
- [CloudWatch Monitoring](/interview-prep/aws-cloud/cloudwatch-monitoring)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Lambda Serverless Architecture](/interview-prep/aws-cloud/lambda-serverless)

---

## 📚 Additional Resources

- [AWS Auto Scaling Documentation](https://docs.aws.amazon.com/autoscaling/)
- [Scaling Policies](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html)
- [ASG Best Practices](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-best-practices.html)
- [Instance Refresh](https://docs.aws.amazon.com/autoscaling/ec2/userguide/asg-instance-refresh.html)
