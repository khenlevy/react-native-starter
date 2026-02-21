#!/usr/bin/env node

import { runDevelopmentServers } from '@buydy/dv-monorepo';

/**
 * Configuration for all development services
 * Add or remove services as needed
 */
const SERVICES = [
  {
    name: 'Stocks API',
    command: 'yarn',
    args: ['stocks-api:dev'],
    color: 'blue',
    port: 3001,
  },
  {
    name: 'Web Dashboard',
    command: 'yarn',
    args: ['web:dev'],
    color: 'green',
    port: 3000,
  },
  // Add more services here as needed:
  // {
  //   name: 'Scanner',
  //   command: 'yarn',
  //   args: ['stocks:dev'],
  //   color: 'magenta',
  //   port: 3002,
  // },
];

// Extract ports from services
const ports = SERVICES.reduce((acc, service) => {
  if (service.port) {
    acc[service.name] = service.port;
  }
  return acc;
}, {});

// Run the development servers
runDevelopmentServers({
  title: 'Buydy Development Environment',
  services: SERVICES,
  ports,
});
