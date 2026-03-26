"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', {
      error,
      errorMessage: error.message,
      errorStack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Check if this is a network-related error
    if (error instanceof TypeError && error.message === 'Network request failed') {
      console.error('🚨 CRITICAL: Network request failed error caught by boundary');
      console.error('💡 This typically indicates:');
      console.error('   - Server not responding');
      console.error('   - CORS policy blocking request');
      console.error('   - Network connectivity issues');
      console.error('   - Invalid API endpoint URL');
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReport = () => {
    const report = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.log('📋 Error Report:', report);

    // You could send this to an error reporting service
    alert('Error details have been logged to console. Please check the browser console for details.');
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-gray-600">
                An unexpected error occurred while loading this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Bug className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      Error Details
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {this.state.error?.message || 'Unknown error'}
                    </p>
                    {this.state.error instanceof TypeError &&
                     this.state.error.message === 'Network request failed' && (
                      <div className="mt-2 text-xs text-red-600">
                        <p><strong>Network Error:</strong> This appears to be a network connectivity issue.</p>
                        <p>Please check your internet connection and try again.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReport}
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  Report Issue
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Developer Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                    {this.state.error?.stack}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('🚨 useErrorHandler caught an error:', {
      error,
      errorMessage: error.message,
      errorStack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString()
    });

    // Check for network errors
    if (error instanceof TypeError && error.message === 'Network request failed') {
      console.error('🚨 CRITICAL: Network request failed error caught by useErrorHandler');
    }
  };
}