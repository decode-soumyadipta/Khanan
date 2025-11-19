# Khanan FrontendThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



Modern geospatial intelligence platform for mining activity monitoring and compliance using satellite imagery analysis.## Getting Started



## 🌍 OverviewFirst, run the development server:



Khanan Frontend provides:```bash

- **Real-time Geospatial Analysis** dashboard with interactive mapsnpm run dev

- **Role-based Access Control** (Admin, Geo-Analyst, Verifier, Officer)# or

- **Analysis History** with filtering and exportyarn dev

- **Dynamic Sidebar Navigation** with role-based item injection# or

- **Responsive Design** with Tailwind CSS and Material-UIpnpm dev

- **Multi-tenant Support** for government agencies# or

bun dev

## 🚀 Quick Start```



### PrerequisitesOpen [http://localhost:3000](http://localhost:3000) with your browser to see the result.

- Node.js 18+

- npm or yarnYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

- Backend API running (see [KhananNetra_backend/README.md](../KhananNetra_backend/README.md))

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Local Development

## Learn More

```bash

# Install dependenciesTo learn more about Next.js, take a look at the following resources:

npm install

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

# Start development server- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

npm run dev

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

# Open browser

# http://localhost:3000## Deploy on Vercel

```

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Environment Setup

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Create `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=

# Optional: Feature Flags
NEXT_PUBLIC_FEATURE_NEW_ANALYSIS=true
NEXT_PUBLIC_FEATURE_HISTORY=true
```

## 📁 Project Structure

```
Khanan/
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.mjs          # PostCSS plugins
├── package.json                # Dependencies
│
├── public/                      # Static assets
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   ├── globals.css          # Global styles
│   │   ├── admin/               # Admin pages
│   │   ├── geoanalyst-dashboard/# Geo-analyst portal
│   │   ├── login/               # Login page
│   │   └── profile/             # User profile
│   │
│   ├── components/
│   │   ├── layout/              # Layout components
│   │   ├── sidebar/             # Sidebar with injection system
│   │   ├── geoanalyst/          # Geospatial components
│   │   └── ui/                  # Reusable UI components
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Authentication state
│   │   ├── AnalysisContext.tsx  # Analysis state
│   │   └── SnackbarContext.tsx  # Notifications
│   │
│   ├── hooks/
│   │   └── use-mobile.ts        # Mobile detection
│   │
│   ├── services/
│   │   ├── apiClient.ts         # Axios instance
│   │   ├── historyService.ts    # History API calls
│   │   └── geoanalyst/          # Geospatial services
│   │
│   └── types/                   # TypeScript interfaces
│
└── .github/
    └── workflows/
        └── deploy-vercel.yml    # Vercel deployment
```

## 🏗️ Architecture

### Sidebar Item Injection System

Features dynamic sidebar items based on user role:

- **SidebarItemsRegistry.tsx**: Context-based registry for managing sidebar items
- **SidebarItemComponent.tsx**: Reusable item renderer with styling variants
- **InjectedItemsSection.tsx**: Section renderer for injected items
- **GeoAnalystItemsInjection.tsx**: Role-specific injection for geo-analysts

Items are injected/ejected dynamically based on user role:

```
LayoutClient (App Wrapper)
  ↓
SidebarItemsRegistryProvider (Context)
  ↓
GeoAnalystItemsInjection (Effect)
  ├─ Detects user role
  ├─ Injects "New Analysis" & "Analysis History" for geo-analysts
  └─ Cleans up on logout
```

## 🔐 Authentication & Authorization

### User Roles

- **Super Admin**: Platform administration, user management
- **Geo-Analyst**: Create and manage analysis, view results
- **Senior Geo-Officer**: Oversee geo-analysts
- **NTRO Nodal Officer**: Compliance verification
- **Verifier**: Verify analysis results

### Protected Routes

- `/admin` → Super Admin only
- `/geoanalyst-dashboard` → Geo-Analyst and Officers
- `/profile` → All authenticated users

## 🎨 Styling

### Tailwind CSS + Material-UI

Primary styling with Tailwind CSS for utility classes:

```tsx
<div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
  <h1 className="text-2xl font-bold">Title</h1>
  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Action
  </button>
</div>
```

### Icons (Lucide React)

```tsx
import { MapPin, BarChart3, LogOut } from 'lucide-react';
```

## 🌐 API Integration

Frontend communicates with backend via:

1. **Next.js Rewrites** (`next.config.ts`): Forward `/api/*` calls to backend
2. **Axios Client** (`apiClient.ts`): Configured with auth headers and error handling
3. **Service Layer**: Organized API calls in `src/services/`

Example flow:
```
Component → useQuery(['history']) → historyService.fetch()
            → apiClient.get('/history') → Backend (via rewrite)
```

## 🚀 Deployment

### Vercel (Recommended)

Automatic deployment on push to GitHub:

1. Connect GitHub repository to Vercel
2. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://backend-url/api
   ```
3. Push to `main` branch

### Local Development

```bash
npm install
npm run dev
# http://localhost:3000
```

### Docker

```bash
docker build -t khanan-frontend .
docker run -p 3000:3000 khanan-frontend
```

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [API Configuration](./API_URL_FIX.md)
- [Backend README](../KhananNetra_backend/README.md)
- [Architecture](./ARCHITECTURE.md)

## 🔗 Related Projects

- [KhananNetra Backend](../KhananNetra_backend/)
- [Legacy Frontend](./old_front/)

## 📄 License

Government of India - Ministry of Mines

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes: `git commit -am 'Add feature'`
3. Push and create Pull Request

---

**Last Updated**: November 18, 2025

For backend setup, see [KhananNetra Backend README](../KhananNetra_backend/README.md)
