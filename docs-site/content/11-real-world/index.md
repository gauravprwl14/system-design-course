# Real-World Systems

Learn by studying how top companies actually built their systems. Each case study covers the problem, requirements, architecture, trade-offs, and what you'd say in an interview.

```mermaid
graph TD
    subgraph "Media & Streaming"
        NF[Netflix\n230M subscribers]
        YT[YouTube\n500h video/min]
        SP[Spotify\n600M users]
    end
    subgraph "Marketplace & Real-Time"
        UB[Uber\nGeo-matching at scale]
        TK[Ticket Booking\nHigh-concurrency inventory]
    end
    subgraph "Messaging & Feeds"
        CH[Chat System\n100B msgs/day]
        NW[News Feed\nFan-out on write vs read]
        NT[Notification System\nMulti-channel delivery]
    end
    subgraph "Storage & Infrastructure"
        GD[Google Drive\nExabytes of data]
        PS[Payment System\nExactly-once money movement]
        URL[URL Shortener\nBillions of redirects/day]
    end
```

## Case Studies

| System | Key Challenge | Scale |
|--------|---------------|-------|
| [Netflix](/11-real-world/netflix) | Video streaming globally | 230M+ subscribers |
| [YouTube](/11-real-world/youtube) | Video upload, processing, delivery | 500h video/minute uploaded |
| [Spotify](/11-real-world/spotify) | Music streaming with personalization | 600M+ users |
| [Uber](/11-real-world/uber-backend) | Real-time geo-matching | Millions of rides/day |
| [Payment System](/11-real-world/payment-system) | Exactly-once money movement | Billions in daily volume |
| [Chat System](/11-real-world/chat-system) | Real-time messaging at scale | WhatsApp: 100B messages/day |
| [News Feed](/11-real-world/news-feed) | Fan-out on write vs read | Facebook: 1.5B users |
| [Notification System](/11-real-world/notification-system) | Multi-channel delivery | Billions of notifications/day |
| [Google Drive](/11-real-world/google-drive) | Distributed file storage | Exabytes of data |
| [URL Shortener](/11-real-world/url-shortener) | High read, low write | Billions of redirects/day |
| [Pastebin](/11-real-world/pastebin) | Content storage & retrieval | — |
| [Rate Limiter](/11-real-world/rate-limiter) | Protect APIs from abuse | — |
| [Ticket Booking](/11-real-world/ticket-booking) | Concurrency & inventory | Millions of tickets sold |
| [Unique ID Generator](/11-real-world/unique-id-generator) | Globally unique, sortable IDs | Millions/second |
