# AWS CloudWatch Monitoring & Alarms

## Question
**"How do you monitor applications in AWS? Explain CloudWatch metrics, alarms, dashboards, and logs. How do you set up alerting?"**

Common in: AWS, DevOps, SRE interviews

---

## 📊 Quick Answer

**CloudWatch** = AWS monitoring and observability service

**Key Components**:
1. **Metrics**: Time-series data (CPU, memory, request count)
2. **Alarms**: Trigger actions when metrics cross thresholds
3. **Logs**: Centralized log management
4. **Dashboards**: Visualize metrics
5. **Events/EventBridge**: Trigger actions on AWS events

**Common Use Cases**:
- Alert when CPU > 80%
- Alert when error rate > 1%
- Alert when disk space < 10%
- Dashboard showing system health
- Centralized application logs

---

## 🎯 Complete Solution

### 1. CloudWatch Metrics

#### Built-in Metrics (Automatic)

```javascript
// EC2 metrics (automatic, no code needed)
// - CPUUtilization
// - NetworkIn/NetworkOut
// - DiskReadBytes/DiskWriteBytes
// - StatusCheckFailed

// ELB metrics (automatic)
// - RequestCount
// - TargetResponseTime
// - HTTPCode_Target_2XX_Count
// - HTTPCode_Target_5XX_Count
// - UnHealthyHostCount

// Lambda metrics (automatic)
// - Invocations
// - Duration
// - Errors
// - Throttles
```

#### Custom Metrics (Application-Level)

```javascript
// publish-custom-metrics.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

class CloudWatchMetrics {
  constructor(namespace) {
    this.namespace = namespace;
    this.cw = new AWS.CloudWatch();
  }

  // Publish single metric
  async putMetric(metricName, value, unit = 'Count') {
    const params = {
      Namespace: this.namespace,
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: [
          {
            Name: 'Environment',
            Value: process.env.NODE_ENV || 'development'
          }
        ]
      }]
    };

    await this.cw.putMetricData(params).promise();
  }

  // Publish multiple metrics (batch)
  async putMetrics(metrics) {
    const params = {
      Namespace: this.namespace,
      MetricData: metrics.map(m => ({
        MetricName: m.name,
        Value: m.value,
        Unit: m.unit || 'Count',
        Timestamp: new Date(),
        Dimensions: m.dimensions || []
      }))
    };

    await this.cw.putMetricData(params).promise();
  }

  // Track API response time
  async trackResponseTime(endpoint, duration) {
    await this.putMetric('APIResponseTime', duration, 'Milliseconds');
  }

  // Track business metrics
  async trackOrderPlaced(amount) {
    await this.putMetrics([
      { name: 'OrdersPlaced', value: 1, unit: 'Count' },
      { name: 'OrderValue', value: amount, unit: 'None' }
    ]);
  }

  // Track errors
  async trackError(errorType) {
    await this.putMetric('Errors', 1, 'Count');
  }
}

// Usage in Express app
const metrics = new CloudWatchMetrics('MyApp/API');

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - start;

    // Track response time
    await metrics.trackResponseTime(req.path, duration);

    // Track requests
    await metrics.putMetric('Requests', 1);

    // Track errors
    if (res.statusCode >= 500) {
      await metrics.trackError('5xx');
    }
  });

  next();
});

// Track business events
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);

  // Track order placed
  await metrics.trackOrderPlaced(order.total);

  res.json(order);
});
```

---

### 2. CloudWatch Alarms

```javascript
// create-alarms.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

class AlarmManager {
  constructor() {
    this.cw = new AWS.CloudWatch();
    this.sns = new AWS.SNS();
  }

  // Create high CPU alarm
  async createCPUAlarm(instanceId, snsTopicArn) {
    await this.cw.putMetricAlarm({
      AlarmName: `high-cpu-${instanceId}`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,  // 2 consecutive periods
      MetricName: 'CPUUtilization',
      Namespace: 'AWS/EC2',
      Period: 300,  // 5 minutes
      Statistic: 'Average',
      Threshold: 80.0,  // 80% CPU
      ActionsEnabled: true,
      AlarmActions: [snsTopicArn],  // Send SNS notification
      AlarmDescription: 'Alert when CPU exceeds 80%',
      Dimensions: [{
        Name: 'InstanceId',
        Value: instanceId
      }]
    }).promise();
  }

  // Create error rate alarm
  async createErrorRateAlarm(snsTopicArn) {
    await this.cw.putMetricAlarm({
      AlarmName: 'high-error-rate',
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      Metrics: [
        {
          Id: 'errors',
          ReturnData: false,
          MetricStat: {
            Metric: {
              Namespace: 'MyApp/API',
              MetricName: 'Errors',
              Dimensions: []
            },
            Period: 60,
            Stat: 'Sum'
          }
        },
        {
          Id: 'requests',
          ReturnData: false,
          MetricStat: {
            Metric: {
              Namespace: 'MyApp/API',
              MetricName: 'Requests',
              Dimensions: []
            },
            Period: 60,
            Stat: 'Sum'
          }
        },
        {
          Id: 'error_rate',
          Expression: 'errors / requests * 100',
          ReturnData: true
        }
      ],
      Threshold: 1.0,  // 1% error rate
      AlarmActions: [snsTopicArn],
      AlarmDescription: 'Alert when error rate exceeds 1%'
    }).promise();
  }

  // Create composite alarm (multiple conditions)
  async createCompositeAlarm(snsTopicArn) {
    await this.cw.putCompositeAlarm({
      AlarmName: 'system-unhealthy',
      AlarmRule: '(ALARM(high-cpu) OR ALARM(high-error-rate)) AND ALARM(low-disk-space)',
      ActionsEnabled: true,
      AlarmActions: [snsTopicArn],
      AlarmDescription: 'System is unhealthy - multiple issues'
    }).promise();
  }

  // Create SNS topic for notifications
  async createSNSTopic(email) {
    // Create topic
    const topic = await this.sns.createTopic({
      Name: 'cloudwatch-alarms'
    }).promise();

    // Subscribe email
    await this.sns.subscribe({
      Protocol: 'email',
      TopicArn: topic.TopicArn,
      Endpoint: email
    }).promise();

    console.log('Check your email to confirm subscription');

    return topic.TopicArn;
  }
}

// Usage
const alarmManager = new AlarmManager();

// Setup monitoring
async function setupMonitoring() {
  // Create SNS topic
  const snsTopicArn = await alarmManager.createSNSTopic('alerts@example.com');

  // Create alarms
  await alarmManager.createCPUAlarm('i-1234567890abcdef0', snsTopicArn);
  await alarmManager.createErrorRateAlarm(snsTopicArn);

  console.log('Monitoring setup complete');
}
```

---

### 3. CloudWatch Alarms (Terraform)

```hcl
# cloudwatch-alarms.tf

# SNS topic for notifications
resource "aws_sns_topic" "alerts" {
  name = "cloudwatch-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "team@example.com"
}

# Alarm: High CPU
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU usage exceeds 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }
}

# Alarm: High error rate
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "api-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  threshold           = "1"

  metric_query {
    id          = "error_rate"
    expression  = "errors / requests * 100"
    label       = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "errors"

    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = "60"
      stat        = "Sum"

      dimensions = {
        LoadBalancer = aws_lb.api.arn_suffix
      }
    }
  }

  metric_query {
    id = "requests"

    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = "60"
      stat        = "Sum"

      dimensions = {
        LoadBalancer = aws_lb.api.arn_suffix
      }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Alarm: Unhealthy hosts
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "api-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "Unhealthy hosts detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TargetGroup  = aws_lb_target_group.api.arn_suffix
    LoadBalancer = aws_lb.api.arn_suffix
  }
}
```

---

### 4. CloudWatch Logs

```javascript
// cloudwatch-logs.js
const AWS = require('aws-sdk');
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');

// Setup Winston logger with CloudWatch
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.simple()
    }),

    // CloudWatch transport
    new WinstonCloudWatch({
      logGroupName: '/aws/api/production',
      logStreamName: `api-server-${new Date().toISOString().split('T')[0]}`,
      awsRegion: 'us-east-1',
      jsonMessage: true
    })
  ]
});

// Usage in Express app
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  next();
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);

    logger.info('User fetched', {
      userId: req.params.id,
      duration: Date.now() - req.startTime
    });

    res.json(user);
  } catch (err) {
    logger.error('Error fetching user', {
      userId: req.params.id,
      error: err.message,
      stack: err.stack
    });

    res.status(500).json({ error: 'Internal error' });
  }
});

// Log uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack
  });

  process.exit(1);
});
```

#### CloudWatch Insights Queries

```
# Query 1: Find errors in last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# Query 2: Find slow API requests
fields @timestamp, method, path, duration
| filter duration > 1000
| sort duration desc
| limit 20

# Query 3: Count errors by endpoint
fields path, @message
| filter level = "error"
| stats count() by path
| sort count desc

# Query 4: P95 response time
fields duration
| filter ispresent(duration)
| stats pct(duration, 95) as p95, pct(duration, 99) as p99, avg(duration) as avg
```

---

### 5. CloudWatch Dashboard

```javascript
// create-dashboard.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function createDashboard() {
  await cloudwatch.putDashboard({
    DashboardName: 'API-Monitoring',
    DashboardBody: JSON.stringify({
      widgets: [
        // CPU Utilization
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/EC2', 'CPUUtilization', { stat: 'Average' }]
            ],
            period: 300,
            stat: 'Average',
            region: 'us-east-1',
            title: 'EC2 CPU Utilization',
            yAxis: {
              left: { min: 0, max: 100 }
            }
          }
        },

        // Request Count
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/ApplicationELB', 'RequestCount', { stat: 'Sum' }]
            ],
            period: 60,
            stat: 'Sum',
            region: 'us-east-1',
            title: 'API Request Count'
          }
        },

        // Error Rate
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              [{ expression: 'errors / requests * 100', id: 'error_rate', label: 'Error Rate %' }],
              ['AWS/ApplicationELB', 'HTTPCode_Target_5XX_Count', { id: 'errors', visible: false }],
              ['.', 'RequestCount', { id: 'requests', visible: false }]
            ],
            period: 60,
            region: 'us-east-1',
            title: 'API Error Rate',
            yAxis: {
              left: { min: 0, max: 5 }
            }
          }
        },

        // Response Time
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/ApplicationELB', 'TargetResponseTime', { stat: 'Average', label: 'Average' }],
              ['...', { stat: 'p95', label: 'P95' }],
              ['...', { stat: 'p99', label: 'P99' }]
            ],
            period: 60,
            region: 'us-east-1',
            title: 'API Response Time'
          }
        },

        // Logs Widget
        {
          type: 'log',
          x: 0,
          y: 12,
          width: 24,
          height: 6,
          properties: {
            query: `SOURCE '/aws/api/production'\n| fields @timestamp, @message\n| filter level = "error"\n| sort @timestamp desc\n| limit 20`,
            region: 'us-east-1',
            title: 'Recent Errors'
          }
        }
      ]
    })
  }).promise();

  console.log('Dashboard created: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=API-Monitoring');
}
```

---

## 📊 Best Practices

### 1. Alarm Threshold Selection

```javascript
// DON'T: Set threshold too sensitive
// CPU > 50% = Too many false alarms

// DO: Use reasonable thresholds
// CPU > 80% for 2 consecutive 5-min periods

// DON'T: Alert on single spike
// evaluation_periods = 1

// DO: Wait for sustained issue
// evaluation_periods = 2-3

// Pattern: Warning at 70%, Critical at 90%
await createAlarm('cpu-warning', 70, 'low');    // Low priority
await createAlarm('cpu-critical', 90, 'high');  // High priority
```

---

### 2. Cost Optimization

```javascript
// CloudWatch Pricing:
// - Metrics: $0.30 per metric/month (first 10k free)
// - Alarms: $0.10 per alarm/month (first 10 free)
// - Logs: $0.50 per GB ingested, $0.03 per GB stored
// - Dashboards: $3 per dashboard/month

// Optimization:
// 1. Use log retention policies
await cloudwatchLogs.putRetentionPolicy({
  logGroupName: '/aws/api/production',
  retentionInDays: 7  // Keep logs for 7 days only
}).promise();

// 2. Batch metrics (up to 20 per API call)
await metrics.putMetrics([
  { name: 'Metric1', value: 1 },
  { name: 'Metric2', value: 2 },
  // ... up to 20
]);

// 3. Use high-resolution metrics only when needed
// Standard: 1-minute resolution (free)
// High-resolution: 1-second resolution (expensive!)
```

---

## 🎓 Interview Tips

### Common Questions

**Q: How do you monitor Lambda functions?**
A: "CloudWatch automatically collects Lambda metrics (invocations, duration, errors, throttles). Add custom metrics with putMetricData for business logic. Use CloudWatch Logs for function logs. Set alarms on error rate and duration P99."

**Q: What's the difference between CloudWatch Metrics and CloudWatch Logs?**
A: "Metrics = Time-series numerical data (CPU, request count). Logs = Text-based event data (application logs). Metrics for quantitative monitoring, Logs for debugging and audit trail."

**Q: How do you create a composite alarm?**
A: "Combine multiple alarms with AND/OR logic. Example: Alert only when BOTH high CPU AND high error rate occur simultaneously. Uses putCompositeAlarm API with alarm_rule parameter."

**Q: How do you handle alarm fatigue?**
A: "1) Set appropriate thresholds (80% not 50%), 2) Use evaluation_periods (wait for sustained issue), 3) Create composite alarms (multiple conditions), 4) Use SNS filtering for different severity levels, 5) Regular alarm review and tuning."

---

## 🔗 Related Questions

- [Auto-Scaling Groups](/interview-prep/aws-cloud/auto-scaling)
- [Load Balancer (ALB/NLB)](/interview-prep/aws-cloud/load-balancer)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)
- [API Metrics (P95/P99)](/interview-prep/caching-cdn/api-metrics)

---

## 📚 Additional Resources

- [CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/)
