
import React from 'react';

const TeamMember: React.FC<{ name: string; role: string; imageUrl: string }> = ({ name, role, imageUrl }) => (
    <div className="text-center">
        <img className="mx-auto h-40 w-40 rounded-full object-cover" src={imageUrl} alt={name} />
        <h3 className="mt-6 text-base font-semibold leading-7 tracking-tight text-white">{name}</h3>
        <p className="text-sm leading-6 text-blue-400">{role}</p>
    </div>
);


const AboutPage: React.FC = () => {
    return (
        <div className="bg-gray-900 pt-20">
            <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl text-glow fade-in">About Us</h1>
                        <p className="mt-6 text-lg leading-8 text-gray-300 fade-in fade-in-delay-1">
                            We are a team of fitness enthusiasts, data scientists, and engineers dedicated to revolutionizing the way you train. Our mission is to make elite-level fitness coaching accessible to everyone, everywhere.
                        </p>
                    </div>

                    <div className="mt-20 text-center">
                         <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl fade-in">Our Mission</h2>
                         <p className="mt-6 text-lg leading-8 text-gray-300 max-w-3xl mx-auto fade-in fade-in-delay-1">
                            To empower individuals to achieve their peak physical potential through cutting-edge AI technology, personalized feedback, and a supportive community. We believe that with the right guidance, anyone can train smarter, prevent injuries, and unlock their true strength.
                         </p>
                    </div>

                    <div className="mt-20">
                        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-center fade-in">Meet Our Team</h2>
                         <ul role="list" className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                            <li className="fade-in">
                                <TeamMember name="Alex Ray" role="Founder & CEO" imageUrl="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1974&auto=format&fit=crop" />
                            </li>
                             <li className="fade-in fade-in-delay-1">
                                <TeamMember name="Jordan Lee" role="Head of AI" imageUrl="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1974&auto=format&fit=crop" />
                            </li>
                             <li className="fade-in fade-in-delay-2">
                                <TeamMember name="Casey Morgan" role="Lead Fitness Expert" imageUrl="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=2070&auto=format&fit=crop" />
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
