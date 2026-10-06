import React from 'react';
import Spinner from '../Spinner/Spinner.jsx';

export default function PageSkeleton() {
  return (
    <div style={{
      padding: '40px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%'
    }}>
      <Spinner size="lg" />
    </div>
  );
}