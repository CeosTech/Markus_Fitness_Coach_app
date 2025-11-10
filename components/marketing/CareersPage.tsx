
import React from 'react';

const JobOpening: React.FC<{ title: string; location: string; description: string }> = ({ title, location, description }) => (
    <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="text-sm text-blue-400">{location}</p>
            </div>
            <a href="#" className="text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">Apply</a>
        </div>
        <p className="mt-4 text-gray-400">{description}</p>
    </div>
);

const CareersPage: React.FC = () => {
    return (
        <div className="bg-gray-900 pt-20">
            <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl text-glow fade-in">Join Our Team</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-300 fade-in fade-in-delay-1">
                            We're looking for passionate, innovative people to join us on our mission to redefine fitness. If you're excited by the intersection of technology and human potential, you're in the right place.
                        </p>
                    </div>

                    <div className="mt-20 max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-center mb-12 fade-in">Current Openings</h2>
                        <div className="space-y-8">
                            <div className="fade-in">
                                <JobOpening 
                                    title="Senior Backend Engineer"
                                    location="Remote"
                                    description="Design and build the scalable infrastructure that powers our AI models and user experiences. Expertise in Python, Docker, and cloud services is a must."
                                />
                            </div>
                            <div className="fade-in fade-in-delay-1">
                                <JobOpening 
                                    title="AI/ML Research Scientist"
                                    location="San Francisco, CA"
                                    description="Push the boundaries of human motion analysis. Develop and train new models to provide even more accurate and insightful feedback to our users."
                                />
                            </div>
                             <div className="fade-in fade-in-delay-2">
                                <JobOpening 
                                    title="Lead Product Designer (UX/UI)"
                                    location="Remote"
                                    description="Craft intuitive, beautiful, and motivating user interfaces that make complex data easy to understand. A passion for fitness and user-centered design is key."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CareersPage;
