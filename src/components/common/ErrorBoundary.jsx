import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Page rendering failed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ maxWidth: 560, margin: '12vh auto', padding: 24 }} role="alert">
        <p style={{ color: '#ad783e', fontWeight: 700 }}>NI Fashion</p>
        <h1>This page could not be displayed</h1>
        <p>Your data was not submitted. You can retry this page or return to your home screen.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" onClick={() => window.location.reload()}>Retry page</button>
          <a href={this.props.home}>Go to home</a>
        </div>
      </main>
    );
  }
}
