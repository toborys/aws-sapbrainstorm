export const config = {
  cognito: {
    customerPool: {
      userPoolId: import.meta.env.VITE_COGNITO_CUSTOMER_POOL_ID || '',
      clientId: import.meta.env.VITE_COGNITO_CUSTOMER_CLIENT_ID || '',
    },
    teamPool: {
      userPoolId: import.meta.env.VITE_COGNITO_TEAM_POOL_ID || '',
      clientId: import.meta.env.VITE_COGNITO_TEAM_CLIENT_ID || '',
    },
  },
  apiUrl: import.meta.env.VITE_API_URL || '',
} as const
