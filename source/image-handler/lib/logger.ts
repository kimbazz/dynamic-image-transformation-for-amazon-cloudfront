// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * JSON logging utility for structured logging output
 * @param level Log level (info, error, warn, debug)
 * @param message Main log message
 * @param data Additional data to include in the log
 * @param error Error object if applicable
 */
export function LogJSON(level: 'info' | 'error' | 'warn' | 'debug', message: string, data?: any, error?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && { data }),
    ...(error && { 
      error: {
        message: error.message || error,
        name: error.name,
        stack: error.stack,
        ...(typeof error === 'object' ? error : {})
      }
    })
  };
  
  console.log(JSON.stringify(logEntry));
}
