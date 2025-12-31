import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React error boundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream grain-bg flex items-center justify-center p-6">
          <div className="bg-paper rounded-2xl p-8 max-w-md shadow-soft text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-coral/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-semibold text-charcoal mb-2">
              Something went wrong
            </h1>
            <p className="text-charcoal-light mb-6">
              The app encountered an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={this.handleReload}
              className="btn-lift bg-coral text-cream px-6 py-3 rounded-xl font-medium cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
