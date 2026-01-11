# AWS Lambda for Serverless Architecture

## Question
**"Explain AWS Lambda and serverless architecture. When would you use Lambda vs EC2? What are cold starts and how do you mitigate them?"**

Common in: AWS, Cloud Architecture, Backend interviews

---

## 📊 Quick Answer

**AWS Lambda** = Run code without managing servers. Pay only for execution time.

**Lambda vs EC2**:

| Feature | Lambda (Serverless) | EC2 (Traditional) |
|---------|---------------------|-------------------|
| **Management** | Zero server management | Full server control |
| **Scaling** | Automatic (0 to 1000s) | Manual or auto-scaling groups |
| **Cost** | Pay per request | Pay for running time |
| **Cold Start** | 100ms-1s latency | None (always running) |
| **Max Duration** | 15 minutes | Unlimited |
| **Use Case** | Event-driven, sporadic | Long-running, consistent load |

**When to Use Lambda**:
- ✅ Event-driven (S3 uploads, API requests, scheduled tasks)
- ✅ Unpredictable traffic (scales to zero)
- ✅ Short-running tasks (< 15 min)
- ✅ Microservices architecture

**When NOT to Use Lambda**:
- ❌ Long-running processes (> 15 min)
- ❌ Requires persistent connections (WebSockets)
- ❌ Predictable, constant traffic (EC2 cheaper)
- ❌ Needs specific OS/hardware

---

## 🎯 Complete Lambda Implementation

### 1. Basic Lambda Function (Node.js)

```javascript
// hello-lambda.js
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Hello from Lambda!',
      timestamp: new Date().toISOString(),
      requestId: context.requestId
    })
  };

  return response;
};

// Event object (API Gateway trigger):
/*
{
  "httpMethod": "GET",
  "path": "/hello",
  "queryStringParameters": { "name": "Alice" },
  "headers": { "User-Agent": "..." },
  "body": null
}
*/

// Context object:
/*
{
  "requestId": "abc-123",
  "functionName": "hello-lambda",
  "functionVersion": "$LATEST",
  "memoryLimitInMB": "128",
  "getRemainingTimeInMillis": function
}
*/
```

---

### 2. Lambda with API Gateway (REST API)

```javascript
// api-lambda.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { httpMethod, path, pathParameters, body } = event;

  try {
    switch (httpMethod) {
      case 'GET':
        return await getUser(pathParameters.id);

      case 'POST':
        return await createUser(JSON.parse(body));

      case 'PUT':
        return await updateUser(pathParameters.id, JSON.parse(body));

      case 'DELETE':
        return await deleteUser(pathParameters.id);

      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (err) {
    console.error('Error:', err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

async function getUser(userId) {
  const params = {
    TableName: 'Users',
    Key: { id: userId }
  };

  const result = await dynamodb.get(params).promise();

  if (!result.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'User not found' })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.Item)
  };
}

async function createUser(user) {
  const params = {
    TableName: 'Users',
    Item: {
      id: Date.now().toString(),
      ...user,
      createdAt: new Date().toISOString()
    }
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    body: JSON.stringify(params.Item)
  };
}

// API Gateway routes:
// GET    /users/{id}    → getUser
// POST   /users         → createUser
// PUT    /users/{id}    → updateUser
// DELETE /users/{id}    → deleteUser
```

---

### 3. Lambda Triggered by S3 Upload

```javascript
// s3-trigger-lambda.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const sharp = require('sharp'); // Image processing

exports.handler = async (event) => {
  console.log('S3 Event:', JSON.stringify(event, null, 2));

  // Process each uploaded file
  const results = await Promise.all(
    event.Records.map(async (record) => {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing ${bucket}/${key}`);

      // Download original image
      const originalImage = await s3.getObject({
        Bucket: bucket,
        Key: key
      }).promise();

      // Create thumbnail
      const thumbnail = await sharp(originalImage.Body)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailKey = key.replace('uploads/', 'thumbnails/');

      await s3.putObject({
        Bucket: bucket,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/jpeg'
      }).promise();

      console.log(`Thumbnail created: ${thumbnailKey}`);

      return { originalKey: key, thumbnailKey };
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: results })
  };
};

// S3 Event structure:
/*
{
  "Records": [{
    "eventName": "ObjectCreated:Put",
    "s3": {
      "bucket": { "name": "my-bucket" },
      "object": { "key": "uploads/photo.jpg", "size": 1024000 }
    }
  }]
}
*/

// Use case: Automatically resize images on upload
// 1. User uploads image to s3://bucket/uploads/photo.jpg
// 2. Lambda triggers automatically
// 3. Lambda creates thumbnail at s3://bucket/thumbnails/photo.jpg
```

---

### 4. Scheduled Lambda (Cron Jobs)

```javascript
// scheduled-lambda.js
const AWS = require('aws-sdk');
const ses = new AWS.SES();
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Running daily report at', new Date().toISOString());

  // Fetch data for report
  const users = await dynamodb.scan({
    TableName: 'Users',
    FilterExpression: 'lastLoginAt < :yesterday',
    ExpressionAttributeValues: {
      ':yesterday': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }
  }).promise();

  const inactiveUsers = users.Items.length;

  // Send email report
  await ses.sendEmail({
    Source: 'reports@example.com',
    Destination: {
      ToAddresses: ['admin@example.com']
    },
    Message: {
      Subject: { Data: 'Daily User Activity Report' },
      Body: {
        Html: {
          Data: `
            <h2>Daily Report - ${new Date().toLocaleDateString()}</h2>
            <p>Inactive users (no login in 24h): <strong>${inactiveUsers}</strong></p>
          `
        }
      }
    }
  }).promise();

  console.log(`Report sent. ${inactiveUsers} inactive users.`);

  return { statusCode: 200, inactiveUsers };
};

// EventBridge schedule: cron(0 9 * * ? *)
// Runs daily at 9:00 AM UTC

// Other schedule examples:
// rate(5 minutes)  → Every 5 minutes
// rate(1 hour)     → Every hour
// rate(1 day)      → Every day
// cron(0 12 * * ? *) → Daily at 12:00 PM UTC
// cron(0 18 ? * MON-FRI *) → Weekdays at 6 PM UTC
```

---

### 5. Lambda with SQS Queue

```javascript
// sqs-consumer-lambda.js
const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

exports.handler = async (event) => {
  console.log(`Processing ${event.Records.length} messages`);

  // Process messages in batches
  const results = await Promise.all(
    event.Records.map(async (record) => {
      const messageBody = JSON.parse(record.body);

      try {
        // Process message
        await processOrder(messageBody);

        return { messageId: record.messageId, status: 'success' };
      } catch (err) {
        console.error('Processing failed:', err);

        // Message will be retried or sent to DLQ
        throw err;
      }
    })
  );

  return { batchItemFailures: [] }; // Return failed messages for retry
};

async function processOrder(order) {
  console.log('Processing order:', order.orderId);

  // Simulate order processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Send confirmation email, update inventory, etc.
  console.log('Order processed:', order.orderId);
}

// SQS Event structure:
/*
{
  "Records": [{
    "messageId": "abc-123",
    "body": "{\"orderId\": \"order-456\", \"total\": 99.99}",
    "attributes": {
      "ApproximateReceiveCount": "1",
      "SentTimestamp": "1234567890"
    }
  }]
}
*/

// Benefits:
// - Decoupled: API returns immediately, Lambda processes async
// - Retries: Failed messages automatically retry
// - Scalable: Lambda scales with queue depth
```

---

## ⚡ Cold Start Optimization

### Understanding Cold Starts

```
Cold Start (1st invocation):
1. Download function code (50-200ms)
2. Initialize runtime (100-500ms)
3. Initialize your code (50-200ms)
Total: 200-900ms

Warm Invocation (subsequent):
1. Reuse existing container
Total: 1-10ms (100x faster!)
```

### Strategy 1: Provisioned Concurrency

```javascript
// serverless.yml (Serverless Framework)
functions:
  api:
    handler: handler.main
    provisionedConcurrency: 5  # Keep 5 instances warm

    # Or auto-scaling provisioned concurrency
    provisionedConcurrency:
      min: 2
      max: 10
      targetUtilization: 0.7  # Scale at 70% utilization

// Benefits:
// - Zero cold starts for provisioned instances
// - Consistent low latency

// Cost:
// - Pay for provisioned instances even when idle
// - $0.000004167 per GB-second (hourly)
```

### Strategy 2: Warm-up Lambda

```javascript
// warmup-lambda.js
exports.handler = async (event) => {
  // Detect warmup event
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    return { statusCode: 200, body: 'warmed' };
  }

  // Normal request handling
  return await handleRequest(event);
};

// CloudWatch Event triggers Lambda every 5 minutes
// Keeps container warm and avoids cold starts
```

### Strategy 3: Lazy Loading

```javascript
// ❌ BAD: Load dependencies at top level (cold start = 500ms)
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sharp = require('sharp');
const axios = require('axios');

exports.handler = async (event) => {
  // All dependencies loaded even if not needed!
};

// ✅ GOOD: Lazy load dependencies (cold start = 200ms)
let s3, dynamodb;

exports.handler = async (event) => {
  // Only load what you need
  if (event.operation === 's3') {
    if (!s3) {
      const AWS = require('aws-sdk');
      s3 = new AWS.S3();
    }
    // Use s3
  } else if (event.operation === 'dynamodb') {
    if (!dynamodb) {
      const AWS = require('aws-sdk');
      dynamodb = new AWS.DynamoDB.DocumentClient();
    }
    // Use dynamodb
  }
};
```

### Strategy 4: Increase Memory (Faster CPU)

```javascript
// serverless.yml
functions:
  api:
    handler: handler.main
    memorySize: 1024  # More memory = faster CPU = faster cold start

// Memory vs Cold Start:
// 128 MB: 900ms cold start
// 512 MB: 500ms cold start
// 1024 MB: 300ms cold start
// 3008 MB: 200ms cold start

// Cost: Proportional to memory, but faster = shorter duration
// Often cheaper overall!
```

---

## 💰 Cost Optimization

### Lambda Pricing

```
Costs:
1. Request charges: $0.20 per 1M requests
2. Duration charges: $0.0000166667 per GB-second

Example:
- 10 million requests/month
- 512 MB memory
- 200ms average duration

Requests: 10M × $0.20 / 1M = $2.00
Duration: 10M × 0.2s × 0.5GB × $0.0000166667 = $16.67
Total: $18.67/month

Compare to EC2:
- t3.medium (2 vCPU, 4GB): $30/month (always running)
- Lambda: $18.67/month (only when used)
```

### Cost Optimization Strategies

```javascript
// 1. Right-size memory (test different sizes)
// Too little: Slow execution = higher cost
// Too much: Wasted memory = higher cost
// Sweet spot: Balance speed and memory

// 2. Batch processing
// ❌ BAD: 1000 invocations × 10ms = 10,000ms = 10 requests
await Promise.all(
  items.map(item => lambda.invoke({ FunctionName: 'process-item', Payload: item }))
);

// ✅ GOOD: 1 invocation × 1000ms = 1000ms = 1 request
lambda.invoke({
  FunctionName: 'process-batch',
  Payload: { items }
});

// 3. Use Lambda@Edge sparingly (10x more expensive)

// 4. Avoid polling (use events instead)
// ❌ BAD: Lambda runs every minute to check for new files
// ✅ GOOD: S3 triggers Lambda only when file is uploaded
```

---

## 🎓 Interview Tips

### Common Questions

**Q: What are Lambda cold starts and how do you mitigate them?**
A: "Cold start = delay when Lambda creates new container (200-900ms). Mitigations: 1) Provisioned concurrency (keep instances warm), 2) Increase memory (faster CPU), 3) Lazy load dependencies, 4) Use warmup events. For latency-critical APIs, use provisioned concurrency or consider ECS/EC2."

**Q: Lambda vs EC2 - when to use which?**
A: "Lambda: Event-driven, unpredictable traffic, short tasks (< 15 min), automatic scaling. EC2: Long-running, predictable load, need full OS control, persistent connections. Example: Lambda for image processing, EC2 for database servers."

**Q: What's the maximum Lambda execution time?**
A: "15 minutes. For longer tasks, use: 1) Step Functions to chain Lambdas, 2) ECS Fargate for long jobs, 3) SQS + Lambda for batch processing with checkpoints."

**Q: How does Lambda scaling work?**
A: "Automatic. Concurrent executions = number of requests being processed. Scales from 0 to 1000 concurrency (default), then increases by 500/minute. For burst traffic, can request increased limit. Each invocation gets isolated container."

---

## 🔗 Related Questions

- [S3 TPS Limits & Optimization](/interview-prep/aws-cloud/s3-tps-limits)
- [Load Balancer (ELB/ALB)](/interview-prep/aws-cloud/load-balancer)
- [CloudWatch Monitoring](/interview-prep/aws-cloud/cloudwatch-monitoring)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)

---

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Lambda Pricing Calculator](https://aws.amazon.com/lambda/pricing/)
- [Serverless Framework](https://www.serverless.com/)
