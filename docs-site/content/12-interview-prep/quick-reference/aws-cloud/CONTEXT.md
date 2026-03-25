# 12-interview-prep/quick-reference/aws-cloud/ — Layer 2 Router

AWS cloud service reference sheets and interview scenarios covering networking, compute, storage, databases, messaging, observability, security, and architecture strategy.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to AWS quick reference and study guide |
| aws-sa-interview-scenarios | 50-question Solutions Architect interview master guide with model answers |
| vpc-networking | VPC, subnets, route tables, NAT gateways, VPC peering, and PrivateLink |
| iam-roles-policies | IAM users, roles, policies, permission boundaries, and cross-account access |
| route53-dns | Route 53 routing policies: latency, geolocation, weighted, failover |
| direct-connect-vpn | Dedicated network connectivity: Direct Connect vs Site-to-Site VPN trade-offs |
| ec2-instances | EC2 instance families, purchasing options (on-demand, reserved, spot), and placement groups |
| auto-scaling | ASG scaling policies, target tracking, step scaling, and predictive scaling |
| ecs-eks-fargate | Container orchestration: ECS vs EKS vs Fargate — use cases and differences |
| lambda-serverless | Lambda invocation models, concurrency, cold starts, and event source mappings |
| api-gateway | API Gateway: REST vs HTTP vs WebSocket APIs, throttling, and integration types |
| step-functions | Step Functions for orchestrating multi-step workflows with retries and error handling |
| s3-tps-limits | S3 performance: TPS limits, key prefix optimization, multipart upload, and S3 classes |
| cloudfront-cdn | CloudFront distributions, cache behaviors, signed URLs, and Lambda@Edge |
| global-accelerator-vs-cloudfront | When to use Global Accelerator vs CloudFront — TCP/UDP vs HTTP, latency routing |
| rds-databases | RDS: Multi-AZ, read replicas, Aurora, and choosing instance sizes |
| dynamodb-nosql | DynamoDB: partition key design, GSIs, streams, DAX caching, and capacity modes |
| elasticache-redis | ElastiCache: Redis vs Memcached, cluster mode, eviction policies |
| sqs-sns-eventbridge | SQS queues, SNS fan-out, EventBridge rules — when to use each |
| kinesis-streaming | Kinesis Data Streams vs Firehose vs Analytics — shard sizing and retention |
| athena-glue-data-lake | S3 data lake pattern: Athena query-in-place, Glue catalog, and partitioning |
| cloudwatch-monitoring | CloudWatch metrics, logs, alarms, dashboards, and Contributor Insights |
| cloudtrail-config | CloudTrail audit logging and AWS Config compliance rules |
| load-balancer | ALB vs NLB vs CLB — protocol support, target group types, and sticky sessions |
| waf-shield-guardduty | Web Application Firewall, Shield DDoS protection, and GuardDuty threat detection |
| cognito-auth | Cognito User Pools vs Identity Pools for app authentication and federated identity |
| secrets-manager-ssm | Secrets Manager for automatic rotation vs SSM Parameter Store for config values |
| organizations-scp | AWS Organizations, service control policies, and multi-account governance |
| disaster-recovery | DR strategies: backup/restore, pilot light, warm standby, multi-site active-active |
| aws-well-architected | Six pillars of the Well-Architected Framework with key questions and trade-offs |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Prepare comprehensively for AWS SA exam | aws-sa-interview-scenarios.md |
| Design network isolation in AWS | vpc-networking.md |
| Set up least-privilege access | iam-roles-policies.md |
| Route traffic across AWS regions | route53-dns.md, global-accelerator-vs-cloudfront.md |
| Choose a container platform | ecs-eks-fargate.md |
| Choose between Lambda and EC2 | lambda-serverless.md, ec2-instances.md |
| Select the right database service | rds-databases.md, dynamodb-nosql.md |
| Choose a messaging service | sqs-sns-eventbridge.md, kinesis-streaming.md |
| Set up a data lake | athena-glue-data-lake.md |
| Plan for disaster recovery | disaster-recovery.md |
| Review architecture best practices | aws-well-architected.md |
