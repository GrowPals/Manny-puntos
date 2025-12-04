
import React from 'react';
import { Helmet } from 'react-helmet';

const SEOHelmet = ({ title, description, image }) => {
  const appTitle = "Manny Rewards";
  const appDescription = "Bienvenido a Manny Rewards, el sistema de recompensas exclusivo. Tu tranquilo, yo me encargo.";
  const appUrl = "https://manny.vip/";
  const defaultImage = "https://i.ibb.co/LDLWZhkj/Recurso-1.png";

  const pageTitle = title ? `${title} | ${appTitle}` : `${appTitle} - Tu Sistema de Recompensas`;
  const pageDescription = description || appDescription;
  const pageImage = image || defaultImage;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      
      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={appUrl} />
      <meta property="og:image" content={pageImage} />
      
      {/* Twitter */}
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
    </Helmet>
  );
};

export default SEOHelmet;
