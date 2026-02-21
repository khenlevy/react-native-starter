# Stocks Dashboard - Job Visualization UI

A React-based web application built with TailAdmin components for visualizing and managing stocks scanning jobs.

## Features

- **Modern UI**: Built with Tailwind CSS and TailAdmin components
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Job Management**: Monitor running jobs, view progress, and manage job execution
- **Real-time Updates**: Track job status and progress in real-time
- **Dark Mode Support**: Toggle between light and dark themes
- **Interactive Dashboard**: Charts and analytics for job performance

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icons
- **React Router**: Client-side routing
- **ApexCharts**: Interactive charts and graphs

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.jsx      # Main layout wrapper
│   ├── Sidebar.jsx     # Navigation sidebar
│   └── Header.jsx      # Top header bar
├── pages/              # Page components
│   ├── Dashboard.jsx   # Main dashboard
│   └── Jobs.jsx        # Jobs management page
├── assets/             # Static assets
├── utils/              # Utility functions
├── App.jsx             # Main app component
├── main.jsx            # React entry point
└── index.css           # Global styles
```

## Pages

### Dashboard
- Overview of job statistics
- Recent job activity
- System performance metrics

### Jobs
- List of all jobs with filtering and search
- Job status and progress tracking
- Job management actions (start, stop, restart)

## Customization

The application uses Tailwind CSS for styling. You can customize the appearance by:

1. Modifying `tailwind.config.js` for theme customization
2. Updating `src/index.css` for global styles
3. Using Tailwind utility classes in components

## Future Enhancements

- Real-time job monitoring with WebSocket connections
- Job scheduling and automation
- Advanced analytics and reporting
- User authentication and authorization
- API integration with your stocks scanner backend

## License

This project is part of the Buydy monorepo.
