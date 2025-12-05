import React from 'react';
import VideoIcon from '../icons/VideoIcon';
import ImageIcon from '../icons/ImageIcon';
import LiveIcon from '../icons/LiveIcon';
import ChatIcon from '../icons/ChatIcon';
import PlanIcon from '../icons/PlanIcon';
import ProfileIcon from '../icons/ProfileIcon';
import ToolsIcon from '../icons/ToolsIcon';
import MealIcon from '../icons/MealIcon';
import FoodScanIcon from '../icons/FoodScanIcon';
import { useTranslation } from '../../i18n/LanguageContext';
import { useCMS } from '../../contexts/CMSContext';


// FIX: Changed icon prop type from React.ReactNode to React.ReactElement to allow cloning with new props.
// FIX: Added generic to React.ReactElement to specify that it accepts a className prop, resolving a TypeScript error.
const FeatureSection: React.FC<{
    icon: React.ReactElement<{ className?: string }>;
    title: string;
    description: string;
    imageUrl: string;
    reverse?: boolean;
}> = ({ icon, title, description, imageUrl, reverse = false }) => (
    <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col md:flex-row items-center gap-12 ${reverse ? 'md:flex-row-reverse' : ''}`}>
            <div className="md:w-1/2 fade-in">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="text-blue-500">{React.cloneElement(icon, { className: "h-8 w-8" })}</div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">{title}</h2>
                </div>
                <p className="text-lg text-gray-300">{description}</p>
            </div>
            <div className="md:w-1/2 fade-in fade-in-delay-1">
                <img src={imageUrl} alt={title} className="rounded-lg shadow-2xl object-cover w-full h-80" />
            </div>
        </div>
    </div>
);

const FeaturesPage: React.FC = () => {
  const { t } = useTranslation();
  const { getValue } = useCMS();
  const heroTitle = getValue('marketing.features.title', t('featuresPage.title'));
  const heroSubtitle = getValue('marketing.features.subtitle', t('featuresPage.subtitle'));
  return (
    <div className="bg-gray-900 pt-20">
      <div className="text-center pt-16 pb-12 px-4">
        <h1 className="text-5xl font-extrabold text-white text-glow fade-in">{heroTitle}</h1>
        <p className="mt-4 text-xl text-gray-400 max-w-3xl mx-auto fade-in fade-in-delay-1">{heroSubtitle}</p>
      </div>

      <FeatureSection
        icon={<VideoIcon />}
        title={t('featuresPage.feature1Title')}
        description={t('featuresPage.feature1Desc')}
        imageUrl="/features/fitness1.jpg"
      />

       <FeatureSection
        icon={<LiveIcon />}
        title={t('featuresPage.feature3Title')}
        description={t('featuresPage.feature3Desc')}
        imageUrl="/features/run1.jpg"
        reverse
      />

      <FeatureSection
        icon={<PlanIcon />}
        title={t('featuresPage.feature5Title')}
        description={t('featuresPage.feature5Desc')}
        imageUrl="/features/pexels1.jpg"
      />

      <FeatureSection
        icon={<MealIcon />}
        title={t('featuresPage.feature8Title')}
        description={t('featuresPage.feature8Desc')}
        imageUrl="/features/food1.jpg"
        reverse
      />

      <FeatureSection
        icon={<FoodScanIcon />}
        title={t('featuresPage.feature9Title')}
        description={t('featuresPage.feature9Desc')}
        imageUrl="/features/mealprep.jpg"
      />

       <FeatureSection
        icon={<ProfileIcon />}
        title={t('featuresPage.feature6Title')}
        description={t('featuresPage.feature6Desc')}
        imageUrl="/features/test.jpg"
        reverse={false}
      />

      <FeatureSection
        icon={<ImageIcon />}
        title={t('featuresPage.feature2Title')}
        description={t('featuresPage.feature2Desc')}
        imageUrl="/features/feature1.jpg"
      />
      
      <FeatureSection
        icon={<ChatIcon />}
        title={t('featuresPage.feature4Title')}
        description={t('featuresPage.feature4Desc')}
        imageUrl="/features/pexels3.jpg"
        reverse
      />

      <FeatureSection
        icon={<ToolsIcon />}
        title={t('featuresPage.feature7Title')}
        description={t('featuresPage.feature7Desc')}
        imageUrl="/features/feature1.jpg"
        reverse
      />

    </div>
  );
};

export default FeaturesPage;
