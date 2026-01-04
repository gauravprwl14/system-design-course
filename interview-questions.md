

Comprehensive Technical Topics and Subtopics
Programming Languages & Concepts
Core Java (OOPs, threading, collections)
Advanced Java (servlets, JSP, JDBC)
Synchronous and asynchronous processing
Frameworks and Tools
Spring BootService annotations
Dependency injection
Config server integration
Hibernate (ORM basics, lazy/eager loading)
Angular and React (UI frameworks)
Microservices Architecture
Transition from monolithic to microservices
Service discovery (Eureka)
Communication mechanisms
REST Templates vs. Feign Client
Synchronous and asynchronous messaging
Circuit breaker pattern 
Centralized configuration 
Load balancing
API Gateway 
Distributed transactions 
Logging and tracing microservice failures
Databases
Relational databases (MySQL, PostgreSQL)
NoSQL databases (MongoDB)
Caching (Redis):
Use cases, TTL, and cache eviction
Performance benefits and trade-offs
Security and Authentication
OAuth 2.0
JWT (JSON Web Tokens)
RSA vs AES encryption:
Asymmetric vs. symmetric encryption
Use cases and performance implications
Testing and Deployment
Mock testing for microservices
Automated testing strategies
AWS services:
Lambda for serverless architecture
Elastic Load Balancer
Auto-scaling groups
CloudWatch for monitoring
Performance and Metrics
API metrics:
Response times (P95, P99)
Error rates
Data throughput
Concurrent user load
Scaling strategies:
Service-specific scaling
Handling high-concurrency scenarios
Caching and Data Optimization
Redis caching:
Cache-first data retrieval
TTL and data eviction policies
Cache warmup techniques
Database optimizations:
Indexing
Query optimization
System Design
Scalability and fault tolerance
Handling dependencies across services
Multi-tier architecture design
High availability through redundancy
Soft Skills
Team leadership and mentoring
Client interaction and requirement gathering
Agile methodologies (daily stand-ups, sprints)
Task tracking with JIRA

Refined List of Interview Questions
Programming & Frameworks
What are the key differences between Core and Advanced Java?
How do annotations in Spring Boot simplify microservices development?
Can you explain the role of Hibernate in microservices?
Microservices
What challenges did you face while migrating from monolithic to microservices architecture?
How does Eureka facilitate service discovery in microservices?
What are the advantages of Feign Client over REST Templates in inter-service communication?
How do you ensure fault tolerance in microservices using Hystrix?
Can you explain the Saga pattern for distributed transactions?
What strategies do you use to debug and trace issues across microservices?
Database Management
Why do we use Redis as a cache alongside traditional databases?
How do you decide the TTL for cache entries in Redis?
What are the key differences between relational and NoSQL databases?
How would you optimize a complex SQL query for performance?
Security
What is the difference between RSA and AES encryption?
When would you choose JWT over OAuth 2.0 for authentication?
How do you secure communication between microservices?
Performance
What are the top metrics you track for API performance?
How do you identify and resolve bottlenecks in a high-traffic system?
What’s the significance of monitoring P95 and P99 response times?
AWS and Deployment
How does AWS Lambda fit into a microservices architecture?
What tools do you use to monitor AWS-hosted microservices?
How do you configure auto-scaling in AWS to handle traffic spikes?
Caching
What are the trade-offs of storing all data in Redis instead of a database?
How does Redis improve API performance?
What is your approach to cache invalidation?
System Design
How would you design a system to handle 100,000 concurrent users?
What strategies would you use to scale database reads and writes?
How do you ensure high availability in a multi-region deployment?
Soft Skills
How do you mentor junior developers on your team?
What’s your approach to handling difficult client requirements?
How do you ensure seamless collaboration in an Agile setup?

Common topic across all interview 
Redis Caching Nuances:
Encryption Knowledge:
System Scaling:
Performance Metrics:


Tell me about yourself.
What is the Highest TPS you have worked on?
What tools did you use for Vulnerability Assessments
On a scale of 1-10, how good are you with Spring Boot
Which programming language have you worked with the most
What is chunking/minification and bundling
Difference between RSA / AES
Difference between Hashing and Encryption
Difference between SHA-1 and SHA-2, and what does SHA stand for
Why is asymmetric encryption weaker than symmetrical
Have you worked with Kubernetes
Give examples of errors you encountered while working with Kubernetes and RabbitMQ.
Provide examples of errors that one might encounter in distributed systems with respect to the Request and response cycle.
How will you handle an MITM attack in your app?[Not App Tier]
What is the min-max TPS on AWS S3 Buckets
What AWS services have you used and worked with
Suppose you need to move your microservice from one zone to another. What AWS tool will you use?
What is the Purpose of DR
How will you handle DR on AWS
How will you secure your request at the AWS level?
Design HLD where [similar to iLovePDF.com]
A user can upload 1 or more files
Combine the uploaded multiple files into one
Then show the user a download link, or else show a message that the link will be emailed when the PDF is ready
How will you design / Handle Rate limiting in your app?


Basic Intro, Experience
Main tech stacks
Description about last projects, role within projects
Question about any big issue in project & implemented solution
CDN
Use of CDN
What type of resources are optimal to serve via CDN
How it reduces load on server
Load balancers & gateway
Encryption: Symmetric & Asymmetric
AWS services basic discussion
Problem question: Upload of document by user, conversion to PDF & delivery of PDF to user
How to scale for large set of users
How to handle malicious/corrupt document file upload
Processing via job
S3 for storing uploaded & converted files
Converted file link delivery via Email/Notification
Type of auth mechanisms
Session
JWT
Single sign on mechanism between different websites (via JWT)
Can be implemented by declaring website domains in scope field of JWT payload so that same token is valid for both domains


Introduction
Projects that I worked on, and technologies that I worked with and what was my role during these projects.
Questions around time complexity, like how it is for linear and binary search.
What is cross origin resource sharing? and have you used it?
Set and Map differences, and which algorithm they use.
What is the 3 layered architecture?
what is AOP? and have you used it before?
What does the controller, Service and Repository layers do? and Why can't we merge them as a single class?
What is Spring and how is the IOC happen at the Spring?
How is SpringBoot different from Spring? What it offers ?
OOPS Concepts.
A coding question around arrays, and time complexities of arrays, and asked my approach.
2 arrays , if elements of array 2 are present in array 1, return an array of Boolean for that index
Questions around Kafka, how the Kafka Streams are being processed.
Difference between Controller, Rest Controller, Request Mapping.
What does the service annotation do?
What if we remove the controller annotation and replace it with the service annotation?
How does the cron jobs work?
My familiarity with the front-end.

1.Introduction.
2.Can you write a program that demonstrates the use of Java Streams?
3.Given a string="java is a OOP language", reverse each word without using Streams?
4.Which versions of Java and Spring Boot have you worked with in your projects?
5.When migrating from Spring Boot 2.x to 3.x, what new features or changes did you use?
6.Suppose there is a configuration issue such as in auto-configuration or the POM, where no exception is explicitly thrown. How would you detect and resolve such errors? (The interviewer suggested using the Checkmarx tool)
7.What challenges are commonly encountered when migrating from a monolithic architecture to microservices, and how would you mitigate them?
8.Which automation server have you utilized in your projects for build and deployment processes?
9.What cloud services have you worked with, and how did you integrate them into your application architecture?
10.Have you had hands-on experience with Amazon EKS or CSR? If so, could you describe your involvement?
11.Can you explain your experience with the ELK Stack and how you’ve used it for log management and monitoring?
12.If multiple Kubernetes pods are configured to send logs to a common database and the database fails, what strategy would you adopt to ensure reliability and fault tolerance?
13.How would you design and implement authentication and authorization in a distributed microservices architecture?
14.How would you manage scenarios where multiple users attempt to access the same session from different devices simultaneously?
15.Would be open to working in the frontend as well as backend?


Started off with introduction
Explained about myself, my experiences, about the tech stack that I have worked, about my projects in depth
Which tech stack I have worked upon and which services I have used so far in my projects
Questions about OOPs concepts that I have worked with
Overloading and overwriting in spring boot
Define microservices architecture , what are they, tradeoffs against monolithic architecture
Questions about which service I have used in AWS
Explained cognito, secret manager, KMS, API gateway, DynamoDB, cloudwatch, s3
How did I used S3, explained about how pre signed URL works and file encryption with s3
Was given a coding question
2 arrays , if elements of array 2 are present in array 1, return an array of Boolean for that index
Did that, discussed edge cases, time complexity
Then interview got concluded with a little discussion on my experience on Postgres and JPA



Scalability & Performance Optimization
How do you prepare for flash sales to handle high traffic efficiently?
How do you scale your database to support growing demands?
What are the practical limitations of vertical scaling and horizontal scaling?
What approach would you take to design a high-concurrency API?
Messaging & Event-Driven Architecture
How can you detect message failures in Kafka, and what steps would you take to resolve them?
How do you detect failures in a pub/sub system, and what actions would you take if topics are not processed by subscriber services?
Database & Storage Considerations
What are the differences between SQL and NoSQL databases?
How do you decide when to use SQL versus NoSQL?
What are the constraints of scaling SQL and NoSQL databases?
We have some static pages stored in S3 instead of a database. How can we reduce costs, considering S3 charges for each read and write?
System Design & Cost Optimization
How would you design a Content Management System?
What are the key components of a Content Management System?
How can you reduce costs if read operations are significantly higher than write operations?
Suppose we have 25,000 pages in our legacy ASP.NET system, and we want to avoid updating pages through frequent build deployments. What strategy should we adopt?
Security & Networking
How do you secure your APIs against potential threats?
What is the difference between hashing and encryption? When should you use each?
What is a proxy, and what are the different types of proxies?
Incident Handling & Troubleshooting
You have been informed of issues in your module. What steps would you take to investigate and resolve them?
How do you identify the root cause of performance degradation in a microservices architecture?
What strategies do you use to handle and mitigate cascading failures in distributed systems?
How do you monitor application health and detect anomalies in real-time?
What steps would you take when you receive an alert for high error rates in production?
How do you handle service downtime and communicate effectively with stakeholders?
What logging and monitoring tools do you use to track system failures and performance issues?
Content Delivery & Caching
What is the role of a Content Delivery Network (CDN)?
What caching strategies would you implement for a high-read, low-write application?
How do you ensure cache consistency in a distributed system?
What are the trade-offs between client-side, server-side, and CDN caching?
How do you optimize cache eviction policies for high-performance applications?

topic
Api gateway
DNS
REDIS
POSTGRESQL
