import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

export default function Link({ href, children, ...props }: any) {
  if (!href) return <a {...props}>{children}</a>;
  
  const isHashOrExternal = href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:');
  if (isHashOrExternal) {
    return <a href={href} {...props}>{children}</a>;
  }
  return <RouterLink to={href} {...props}>{children}</RouterLink>;
}
