# AWS Load Balancers: ELB, ALB, NLB

## Question
**"Explain different types of AWS load balancers (ALB, NLB, CLB). When would you use each? How do load balancers improve availability?"**

Common in: AWS, DevOps, System Design interviews

---

## 📊 Quick Answer

**Load Balancer** = Distributes traffic across multiple servers for high availability and scalability

**AWS Load Balancer Types**:

| Type | Full Name | Layer | Use Case | Speed |
|------|-----------|-------|----------|-------|
| **ALB** | Application Load Balancer | Layer 7 (HTTP/HTTPS) | Web applications, microservices, containers | Good |
| **NLB** | Network Load Balancer | Layer 4 (TCP/UDP) | Ultra-low latency, static IP, millions of req/sec | Fastest |
| **CLB** | Classic Load Balancer | Layer 4 & 7 | Legacy (use ALB/NLB instead) | Deprecated |
| **GLB** | Gateway Load Balancer | Layer 3 (IP) | Firewalls, IDS/IPS | Specialized |

**Most Common**: **ALB** (90% of use cases)

---

## 🎯 Application Load Balancer (ALB)

### When to Use ALB

✅ **Use ALB for**:
- HTTP/HTTPS traffic
- Microservices (route by path: /api/users → Service A, /api/orders → Service B)
- Containers (ECS, EKS)
- WebSocket connections
- HTTP/2 support
- Host-based routing (api.example.com → Service A, admin.example.com → Service B)

### ALB Features

```
Request Flow:
Client → ALB → Target Group → EC2/ECS/Lambda

ALB Features:
1. Path-based routing: /api/* → Backend, /static/* → CDN
2. Host-based routing: api.example.com vs www.example.com
3. Header-based routing: X-Custom-Header: mobile → Mobile backend
4. Query string routing: ?version=2 → New API version
5. Health checks: Only send traffic to healthy targets
6. SSL termination: ALB handles HTTPS, backends use HTTP
7. Sticky sessions: Same user → Same server
8. WebSocket support
9. HTTP/2 and gRPC support
```

### ALB Setup (Terraform)

```hcl
# alb.tf
resource "aws_lb" "api" {
  name               = "api-load-balancer"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  enable_deletion_protection = true
  enable_http2               = true

  tags = {
    Environment = "production"
  }
}

# Target group (backend servers)
resource "aws_lb_target_group" "api" {
  name     = "api-target-group"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  # Health check
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  # Deregistration delay
  deregistration_delay = 30

  # Stickiness (session affinity)
  stickiness {
    enabled = true
    type    = "lb_cookie"
    cookie_duration = 86400  # 24 hours
  }
}

# HTTPS listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# HTTP listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Register EC2 instances
resource "aws_lb_target_group_attachment" "api_1" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = aws_instance.api_1.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "api_2" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = aws_instance.api_2.id
  port             = 3000
}
```

### Path-Based Routing

```hcl
# Multiple target groups for microservices
resource "aws_lb_target_group" "users_api" {
  name     = "users-api"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
}

resource "aws_lb_target_group" "orders_api" {
  name     = "orders-api"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
}

# Listener rules (path-based routing)
resource "aws_lb_listener_rule" "users" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.users_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/users/*"]
    }
  }
}

resource "aws_lb_listener_rule" "orders" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.orders_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/orders/*"]
    }
  }
}

# Result:
# https://api.example.com/api/users/*  → Users service (port 3000)
# https://api.example.com/api/orders/* → Orders service (port 3001)
```

### Host-Based Routing

```hcl
# Route different domains to different backends
resource "aws_lb_listener_rule" "api_subdomain" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    host_header {
      values = ["api.example.com"]
    }
  }
}

resource "aws_lb_listener_rule" "admin_subdomain" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 60

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    host_header {
      values = ["admin.example.com"]
    }
  }
}

# Result:
# api.example.com   → API backend
# admin.example.com → Admin backend
```

---

## ⚡ Network Load Balancer (NLB)

### When to Use NLB

✅ **Use NLB for**:
- Ultra-low latency (100 microseconds)
- Millions of requests per second
- Static IP addresses required
- TCP/UDP traffic (non-HTTP)
- WebSocket (long-lived connections)
- Gaming servers
- IoT devices
- Database connections

### NLB vs ALB

```
NLB:
- Layer 4 (TCP/UDP)
- 100 microsecond latency
- Millions of req/sec
- Static IP
- No content-based routing

ALB:
- Layer 7 (HTTP/HTTPS)
- Millisecond latency
- Hundreds of thousands req/sec
- Dynamic IP
- Path/host-based routing
```

### NLB Setup

```hcl
# nlb.tf
resource "aws_lb" "tcp" {
  name               = "tcp-load-balancer"
  internal           = false
  load_balancer_type = "network"
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  # Enable static IPs
  enable_cross_zone_load_balancing = true

  tags = {
    Environment = "production"
  }
}

# Target group (TCP)
resource "aws_lb_target_group" "tcp" {
  name     = "tcp-target-group"
  port     = 5000
  protocol = "TCP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    protocol            = "TCP"
    port                = "5000"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
  }

  # Preserve client IP
  preserve_client_ip = true
}

# TCP listener
resource "aws_lb_listener" "tcp" {
  load_balancer_arn = aws_lb.tcp.arn
  port              = "5000"
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tcp.arn
  }
}
```

### NLB for WebSocket

```javascript
// websocket-server.js (backend)
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  console.log('Client connected from:', req.connection.remoteAddress);

  ws.on('message', (message) => {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// NLB configuration for WebSocket
// - Protocol: TCP (not HTTP)
// - Port: 8080
// - preserve_client_ip: true
// - Stickiness: Not needed (NLB preserves connection)
```

---

## 🔄 Load Balancing Algorithms

### Round Robin (Default)

```
Requests:
1. Server A
2. Server B
3. Server C
4. Server A  (back to start)
5. Server B
...

Use case: All servers have equal capacity
```

### Least Outstanding Requests (ALB)

```
Server A: 10 active requests
Server B: 5 active requests  ← Route here
Server C: 8 active requests

Next request goes to Server B (least busy)

Use case: Servers have varying performance
```

### Weighted Target Groups

```hcl
# A/B testing: 90% to old version, 10% to new version
resource "aws_lb_listener_rule" "weighted" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.v1.arn
        weight = 90
      }

      target_group {
        arn    = aws_lb_target_group.v2.arn
        weight = 10
      }
    }
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# 90% of traffic → v1
# 10% of traffic → v2 (canary deployment)
```

---

## 🏥 Health Checks

### ALB Health Check

```hcl
resource "aws_lb_target_group" "api" {
  name     = "api-target-group"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    port                = "3000"
    healthy_threshold   = 2    # 2 consecutive successes = healthy
    unhealthy_threshold = 3    # 3 consecutive failures = unhealthy
    timeout             = 5    # Wait 5s for response
    interval            = 30   # Check every 30s
    matcher             = "200,201"  # Accept 200 or 201 status
  }
}
```

### Health Check Endpoint

```javascript
// health-check.js
const express = require('express');
const app = express();

// Simple health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Advanced health check (check dependencies)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        redis: 'ok'
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

app.listen(3000);
```

---

## 📊 Monitoring & Metrics

### CloudWatch Metrics

```javascript
// AWS SDK - Get ALB metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function getALBMetrics(loadBalancerArn) {
  const params = {
    Namespace: 'AWS/ApplicationELB',
    MetricName: 'RequestCount',
    Dimensions: [{
      Name: 'LoadBalancer',
      Value: loadBalancerArn.split(':').pop() // app/my-lb/1234567890
    }],
    StartTime: new Date(Date.now() - 3600000), // Last hour
    EndTime: new Date(),
    Period: 300, // 5 minutes
    Statistics: ['Sum']
  };

  const data = await cloudwatch.getMetricStatistics(params).promise();

  console.log('Request count:', data.Datapoints);
  return data;
}

// Key ALB metrics to monitor:
// - RequestCount: Total requests
// - TargetResponseTime: Backend latency
// - HTTPCode_Target_2XX_Count: Successful responses
// - HTTPCode_Target_5XX_Count: Server errors
// - UnHealthyHostCount: Failed health checks
// - ActiveConnectionCount: Current connections
```

---

## 🎓 Interview Tips

### Common Questions

**Q: ALB vs NLB - when to use which?**
A: "ALB for HTTP/HTTPS (web apps, APIs, microservices) with content-based routing. NLB for TCP/UDP (ultra-low latency, static IP, non-HTTP protocols like databases, gaming). Use ALB for 90% of cases."

**Q: How does sticky session work?**
A: "ALB sets a cookie (AWSALB) on first request. Subsequent requests with that cookie go to the same backend server. Useful for stateful apps (shopping carts, sessions). Duration: 1 second to 7 days."

**Q: What happens when a health check fails?**
A: "After unhealthy_threshold failures (e.g., 3), ALB stops sending traffic to that target. Continues health checks every interval (e.g., 30s). After healthy_threshold successes (e.g., 2), routes traffic again. Prevents sending requests to failing servers."

**Q: How do you do zero-downtime deployments with ALB?**
A: "1) Deploy new version to new target group, 2) Add new target group with weight=10 (canary), 3) Monitor metrics, 4) Gradually increase weight to 100, 5) Remove old target group. Or use blue/green deployment with DNS swap."

**Q: Can you have cross-region load balancing?**
A: "No, ALB/NLB are regional. Use Route 53 (DNS) for global load balancing across regions. Route 53 health checks can route traffic away from unhealthy regions."

---

## 🔗 Related Questions

- [Auto-Scaling Groups](/interview-prep/aws-cloud/auto-scaling)
- [CloudWatch Monitoring](/interview-prep/aws-cloud/cloudwatch-monitoring)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Database Scaling Strategies](/interview-prep/database-storage/scaling-strategies)

---

## 📚 Additional Resources

- [ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [NLB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/)
- [Load Balancer Comparison](https://aws.amazon.com/elasticloadbalancing/features/)
- [ALB Best Practices](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/best-practices.html)
