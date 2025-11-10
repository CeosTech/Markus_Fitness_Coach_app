
import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
    return (
        <div className="bg-gray-900 pt-20">
            <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-4xl px-6 lg:px-8">
                    <div className="mx-auto text-left">
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl text-glow fade-in">Privacy Policy</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-300 fade-in fade-in-delay-1">
                            Last Updated: [Date]
                        </p>

                        <div className="mt-12 text-gray-300 space-y-8 fade-in fade-in-delay-2">
                             <h2 className="text-2xl font-bold text-white mt-8">1. Introduction</h2>
                            <p>
                                AI Fitness Coach ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8">2. Information We Collect</h2>
                            <p>
                                We may collect personal information such as your name, email address, and workout data (including videos and images you upload). We also collect non-personal information, such as usage data and device information.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8">3. How We Use Your Information</h2>
                            <p>
                                We use the information we collect to:
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>Provide, operate, and maintain our services.</li>
                                    <li>Improve, personalize, and expand our services.</li>
                                    <li>Understand and analyze how you use our services.</li>
                                    <li>Communicate with you, either directly or through one of our partners.</li>
                                    <li>Process your transactions and manage your account.</li>
                                    <li>For compliance purposes, including enforcing our Terms of Service.</li>
                                </ul>
                            </p>
                            
                             <h2 className="text-2xl font-bold text-white mt-8">4. Data Security</h2>
                            <p>
                               We implement a variety of security measures to maintain the safety of your personal information. However, no electronic storage or transmission over the internet is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
                            </p>
                            
                             <h2 className="text-2xl font-bold text-white mt-8">5. Changes to This Policy</h2>
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
