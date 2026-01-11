# AWS & Cloud Services - Interview Questions

## 📋 Questions Covered

1. [S3 TPS Limits & Optimization](/interview-prep/aws-cloud/s3-tps-limits)
2. [Lambda for Serverless Architecture](/interview-prep/aws-cloud/lambda-serverless)
3. [Load Balancers: ALB, NLB, CLB](/interview-prep/aws-cloud/load-balancer)
4. [Auto-Scaling Groups (ASG)](/interview-prep/aws-cloud/auto-scaling)
5. [CloudWatch Monitoring & Alarms](/interview-prep/aws-cloud/cloudwatch-monitoring)

## 🎯 Quick Reference

| Question | Quick Answer | Article |
|----------|--------------|---------|
| S3 TPS limits? | 3,500 PUT/s, 5,500 GET/s per prefix. Use prefix distribution | [View Article](/interview-prep/aws-cloud/s3-tps-limits) |
| Lambda vs EC2? | Lambda: event-driven, auto-scale. EC2: long-running, full control | [View Article](/interview-prep/aws-cloud/lambda-serverless) |
| ALB vs NLB? | ALB: HTTP/HTTPS, Layer 7. NLB: TCP/UDP, Layer 4, ultra-low latency | [View Article](/interview-prep/aws-cloud/load-balancer) |
| ASG scaling policies? | Target Tracking (most common), Step Scaling, Scheduled, Predictive | [View Article](/interview-prep/aws-cloud/auto-scaling) |
| CloudWatch alarms? | Monitor metrics, trigger actions. Use SNS for notifications | [View Article](/interview-prep/aws-cloud/cloudwatch-monitoring) |

## 💡 Interview Tips

**Common Follow-ups**:
- "How do you handle S3 high throughput?"
- "What's a Lambda cold start and how to fix it?"
- "When would you use NLB over ALB?"
- "How do you prevent scaling oscillation?"
- "How do you monitor error rates?"

**Red Flags to Avoid**:
- ❌ "Lambda is always cheaper than EC2" (depends on usage pattern!)
- ❌ Not understanding S3 prefix distribution
- ❌ Using Classic Load Balancer (deprecated)
- ❌ Setting alarm thresholds too sensitive (alarm fatigue)
- ❌ Not using health checks properly

## 🔥 Real-World Scenarios

### Scenario 1: "API is slow for global users"
**Answer**:
1. Use CloudFront CDN for static content
2. Deploy ALB in multiple regions with Route 53 latency-based routing
3. Use Lambda@Edge for dynamic content at edge locations
4. Monitor with CloudWatch per-region dashboards

### Scenario 2: "S3 uploads throttling during peak hours"
**Answer**:
1. Distribute uploads across multiple prefixes (hash-based)
2. Use multipart upload for large files
3. Enable S3 Transfer Acceleration for distant regions
4. Monitor with CloudWatch S3 metrics

### Scenario 3: "Need to scale from 100 to 10,000 users overnight"
**Answer**:
1. Use Auto-Scaling with Target Tracking (maintain CPU at 50%)
2. Set max_size appropriately (e.g., 100 instances)
3. Enable Predictive Scaling if traffic pattern is known
4. Use CloudWatch alarms for capacity monitoring
5. Consider Lambda for unpredictable, sporadic traffic

## 📊 AWS Architecture Patterns

### Pattern 1: Serverless API
```
API Gateway → Lambda → DynamoDB
           ↓
      CloudWatch Logs
```
**When**: Unpredictable traffic, low maintenance

### Pattern 2: Traditional Web App
```
Route 53 → CloudFront → ALB → ASG (EC2) → RDS
                                    ↓
                              CloudWatch
```
**When**: Predictable traffic, need full control

### Pattern 3: Hybrid
```
API Gateway → Lambda (auth, lightweight)
           → ALB → EC2 (heavy processing)
           → S3 (file storage)
           ↓
      CloudWatch
```
**When**: Mixed workload types

## 💰 Cost Optimization Tips

### S3
- Use Intelligent-Tiering for unpredictable access
- Lifecycle policies to Glacier for old data
- Delete incomplete multipart uploads
- Use CloudFront to reduce GET requests

### Lambda
- Right-size memory (test 512MB, 1024MB, 1536MB)
- Use Provisioned Concurrency only when needed
- Avoid Lambda for constant traffic (EC2 cheaper)
- Batch operations to reduce invocations

### EC2 with ASG
- Use Spot Instances for fault-tolerant workloads
- Reserved Instances for baseline capacity
- Scheduled scaling for predictable patterns
- Right-size instances (don't over-provision)

### CloudWatch
- Set log retention policies (7-30 days)
- Batch metrics (20 per API call)
- Use standard resolution unless needed
- Delete unused alarms and dashboards

## 🛠️ Quick Wins

### 1. S3 Performance (5-minute fix)
```javascript
// Before: Single prefix (3,500 uploads/sec limit)
const key = `uploads/${filename}`;

// After: Hash-based prefix (35,000 uploads/sec)
const hash = crypto.createHash('md5').update(userId).digest('hex');
const prefix = hash.substring(0, 2);  // 00-ff (256 prefixes)
const key = `uploads/${prefix}/${userId}/${filename}`;
```

### 2. Lambda Cold Start (1-line fix)
```javascript
// Add provisioned concurrency
provisionedConcurrency: 5  // Keep 5 instances warm
```

### 3. Auto-Scaling (Terraform snippet)
```hcl
# Target Tracking - maintain CPU at 50%
resource "aws_autoscaling_policy" "cpu_target" {
  policy_type = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 50.0
  }
}
```

## 📈 Monitoring Checklist

### Essential CloudWatch Alarms
- [ ] High CPU (> 80% for 2 periods)
- [ ] High error rate (> 1%)
- [ ] Unhealthy hosts (> 0)
- [ ] High response time (P95 > 1s)
- [ ] Low disk space (< 10%)

### Essential Metrics to Track
- [ ] Request count (throughput)
- [ ] Error count (reliability)
- [ ] Response time P95/P99 (latency)
- [ ] CPU utilization (capacity)
- [ ] Database connections (resource usage)

### Essential Dashboards
- [ ] System overview (CPU, memory, requests)
- [ ] Error tracking (error rate, error types)
- [ ] Performance (response time, throughput)
- [ ] Cost tracking (per service)

---

Start with: [S3 TPS Limits & Optimization](/interview-prep/aws-cloud/s3-tps-limits)
