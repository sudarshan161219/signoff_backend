# Signoff Backend 🛡️

The robust Node.js/Express API powering **Signoff**—a tool for freelancers to get legally binding approvals on their deliverables.

![Status](https://img.shields.io/badge/Status-MVP%20Active-success)
![Node](https://img.shields.io/badge/Node-v18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## 🏗️ Architecture

This backend follows a **Service-Controller-Route** pattern to ensure separation of concerns and scalability.

* **Runtime:** Node.js + Express
* **Database:** PostgreSQL (Managed via Prisma ORM)
* **Validation:** Zod
* **Object Storage:** Cloudflare R2 (S3 Compatible)
* **Security:** Rate Limiting, Helmet, CORS, Bearer Token Auth