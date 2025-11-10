import React, { useState, useEffect } from 'react';
import VideoIcon from '../icons/VideoIcon';
import PlanIcon from '../icons/PlanIcon';
import LiveIcon from '../icons/LiveIcon';
import { MarketingPage } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

interface HomePageProps {
  setPage: (page: MarketingPage) => void;
}

const backgroundImages = [
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=1974&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1975&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop',
];

const FeatureCard: React.FC<{ icon: React.ReactElement<{ className?: string }>; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-lg text-center transform hover:scale-105 transition-transform duration-300 border border-gray-700 shadow-2xl h-full">
        <div className="flex justify-center text-blue-400 mb-4">{React.cloneElement(icon, { className: "h-8 w-8" })}</div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);

const HomePage: React.FC<HomePageProps> = ({ setPage }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { t, translations } = useTranslation();
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);

  const testimonials = translations.homePage.testimonials;

  useEffect(() => {
    const imageTimer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000);
    
    const testimonialTimer = setInterval(() => {
      setCurrentTestimonialIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 6000);

    return () => {
      clearInterval(imageTimer);
      clearInterval(testimonialTimer);
    };
  }, [testimonials.length]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-black/60 z-10"></div>
        {backgroundImages.map((imgUrl, index) => (
             <div 
                key={index}
                className={`absolute top-0 left-0 w-full h-full bg-cover bg-center z-0 transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundImage: `url('${imgUrl}')` }}
            />
        ))}
        <div className="relative z-20 px-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white fade-in" dangerouslySetInnerHTML={{ __html: t('homePage.heroTitle') }}>
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto fade-in fade-in-delay-1">
            {t('homePage.heroSubtitle')}
          </p>
          <div className="mt-10 flex justify-center gap-4 fade-in fade-in-delay-2">
            <button
              onClick={() => setPage('signup')}
              className="px-8 py-4 bg-blue-600 rounded-md font-semibold text-white hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
            >
              {t('homePage.startTrialButton')}
            </button>
            <button
              onClick={() => setPage('features')}
              className="px-8 py-4 bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-md font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              {t('homePage.learnMoreButton')}
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-extrabold text-white mb-4">{t('homePage.featuresTitle')}</h2>
            <p className="text-lg text-gray-400 mb-12 max-w-3xl mx-auto">{t('homePage.featuresSubtitle')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="fade-in"><FeatureCard icon={<VideoIcon />} title={t('homePage.feature1Title')} description={t('homePage.feature1Desc')} /></div>
                <div className="fade-in fade-in-delay-1"><FeatureCard icon={<PlanIcon />} title={t('homePage.feature2Title')} description={t('homePage.feature2Desc')} /></div>
                <div className="fade-in fade-in-delay-2"><FeatureCard icon={<LiveIcon />} title={t('homePage.feature3Title')} description={t('homePage.feature3Desc')} /></div>
            </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-20 bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
           <h2 className="text-4xl font-extrabold text-white mb-12">{t('homePage.testimonialsTitle')}</h2>
           <div className="relative h-64 md:h-56 overflow-hidden">
             {testimonials.map((testimonial: any, index: number) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex flex-col items-center justify-center ${index === currentTestimonialIndex ? 'opacity-100' : 'opacity-0'}`}
                >
                    <img src={testimonial.imageUrl} alt={testimonial.author} className="w-20 h-20 rounded-full object-cover mb-4 shadow-lg"/>
                    <blockquote className="w-full">
                        <p className="text-xl text-gray-300 italic">"{testimonial.quote}"</p>
                        <footer className="mt-4 text-gray-400 font-bold">{testimonial.author}</footer>
                    </blockquote>
                </div>
             ))}
           </div>
            <div className="flex justify-center mt-8 space-x-3">
              {testimonials.map((_: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonialIndex(index)}
                  className={`w-3 h-3 rounded-full transition-colors duration-300 ${index === currentTestimonialIndex ? 'bg-blue-500 scale-125' : 'bg-gray-600 hover:bg-gray-500'}`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
        </div>
      </section>

       {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-extrabold text-white fade-in">{t('homePage.ctaTitle')}</h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto fade-in fade-in-delay-1">
            {t('homePage.ctaSubtitle')}
          </p>
          <div className="mt-8 fade-in fade-in-delay-2">
            <button
              onClick={() => setPage('signup')}
              className="px-10 py-5 bg-blue-600 rounded-md font-semibold text-white text-lg hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
            >
              {t('homePage.ctaButton')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;