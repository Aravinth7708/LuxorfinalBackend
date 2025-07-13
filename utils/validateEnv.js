export const validateEnv = () => {
  const required = [
    'JWT_SECRET',
    'MONGO_URI',
    'NODE_ENV'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters long for security');
  }
  
  console.log('Environment validation passed');
};