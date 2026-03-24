# 🔍 Balik-Calasiao: Lost & Found Admin Portal

A professional, high-performance administrative dashboard for managing the **Balik-Calasiao** Lost & Found app. This application allows administrators to oversee lost and found reports, manage user claims, audit system activities, and maintain the integrity of the platform.

**🌐 Live Dashboard**: [https://balikcalasiao.web.app/](https://balikcalasiao.web.app/)

---

## ✨ Features

- **📊 Dashboard Overview**: Real-time insights into system statistics (Total Found, Total Lost, Pending Claims).
- **📝 Exportable Reports**: Generate and export monthly reports in CSV format for administrative documentation.
- **📦 Found Item Management**: Efficiently track, categorize, and update statuses for found items.
- **❓ Lost Item Tracking**: Monitor lost item reports and facilitate matching with found items.
- **🤝 Claim Processing**: Review and adjudicate claims made by users, ensuring items are returned to their rightful owners.
- **📜 Audit Logs**: Comprehensive logging of administrative actions for transparency and accountability.
- **🔐 Secure Authentication**: Integrated Firebase Authentication with role-based access control.

---

## 🛠️ Tech Stack

- **Core**: [Next.js 15+](https://nextjs.org/) (App Router)
- **UI/Logic**: [React 19](https://react.dev/)
- **Backend & DB**: [Firebase](https://firebase.google.com/)
  - **Firestore**: Scalable NoSQL real-time database.
  - **Auth**: Secure authentication and session management.
  - **Storage**: Firebase Cloud storage for item images and attachments.
- **Styling**: Vanilla CSS with CSS Modules for scoped, maintainable styles.
- **Language**: [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) / [TypeScript](https://www.typescriptlang.org/)

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**
- **Firebase Project**: A configured project on the [Firebase Console](https://console.firebase.google.com/).

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/lostandfound-admin.git
cd lostandfound-admin
npm install
```

### 3. Firebase Configuration

The project is pre-configured with the default Firebase settings in `src/lib/firebase.js`. To use your own instance, update the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the portal

## 🚢 Deployment

The easiest way to deploy is via **Firebase Hosting**:

1. **Build the production bundle**:
   ```bash
   npm run build
   ```

2. **Deploy to Firebase**:
   ```bash
   npx firebase deploy --only hosting
   ```

---
## 👥 Contributors
- DAYOnamics
  
## 📄 License

This project is private and proprietary. Unauthorized copying, modification, or distribution is prohibited.

---

