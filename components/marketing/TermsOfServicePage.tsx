
import React from 'react';

const TermsOfServicePage: React.FC = () => {
    return (
        <div className="bg-gray-900 pt-20">
            <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-4xl px-6 lg:px-8">
                    <div className="mx-auto text-left">
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl text-glow fade-in">Terms of Service</h1>
                         <p className="mt-6 text-lg leading-8 text-gray-300 fade-in fade-in-delay-1">
                            Last Updated: [Date]
                        </p>
                        <div className="mt-12 text-gray-300 space-y-8 fade-in fade-in-delay-2">
                            <h2 className="text-2xl font-bold text-white mt-8">1. Acceptance of Terms</h2>
                            <p>
                                By accessing or using the AI Fitness Coach application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, then you may not access the Service.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8">2. Use of Service</h2>
                            <p>
                                You agree to use the Service only for lawful purposes. You are responsible for all data, including workout videos and images, that you upload to the Service. You must be at least 18 years old to use this Service.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8">3. Disclaimer of Warranty</h2>
                            <p>
                                The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The feedback provided by the AI is for informational purposes only and is not a substitute for professional medical advice or diagnosis. Always consult with a qualified health professional before beginning any fitness program.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8">4. Limitation of Liability</h2>
                            <p>
                                In no event shall AI Fitness Coach, nor its directors, employees, partners, or agents, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                            </p>

                             <h2 className="text-2xl font-bold text-white mt-8">5. Changes to Terms</h2>
                            <p>
                                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsOfServicePage;
