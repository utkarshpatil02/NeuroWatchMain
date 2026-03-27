import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiUser, FiShield, FiChevronDown } from 'react-icons/fi';
import Lottie from 'lottie-react';
import proctorAnimation from '../assets/ai-proctor.json';
import robotAnimation from '../assets/robot-animation.json';
import { useEffect, useRef, useState } from 'react';

// Particle component for the background lights
const Particle = styled(motion.div)`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at center, var(--primary) 0%, transparent 70%);
  pointer-events: none;
  opacity: 0.8;
  box-shadow: 0 0 15px 3px var(--primary);
`;

const LandingContainer = styled.div`
  min-height: 100vh;
  background-color: var(--background);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
`;

const ParticlesContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
`;

const NavBar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 3rem;
  background-color: rgba(var(--card-bg-rgb), 0.8);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
  position: relative;
  z-index: 10;

  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
  }
`;

const Logo = styled.div`
  font-weight: 700;
  font-size: 1.8rem;
  background: linear-gradient(90deg, #5B5FEF 0%, #7E41E0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
  text-shadow: 0 0 10px rgba(91, 95, 239, 0.3);
`;

const NavButtons = styled.div`
  display: flex;
  gap: 16px;
`;

const LoginButton = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background-color: ${props => props.variant === 'admin' ? 'var(--primary)' : 'var(--success)'};
  color: white;
  font-weight: 500;
  cursor: pointer;
  margin-left: 1rem;
  transition: all 0.2s ease;
  box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(var(--primary-rgb), 0.5);
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 0 2rem 4rem;
  text-align: center;
  position: relative;
  z-index: 1;
`;

const HeroSection = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 2rem;
  position: relative;
`;

const RobotAnimationContainer = styled(motion.div)`
  width: 300px;
  height: 300px;
  z-index: 5;
  filter: drop-shadow(0 0 30px rgba(var(--primary-rgb), 0.7));
  margin-bottom: -30px;
`;

const GlowingCircle = styled(motion.div)`
  position: absolute;
  top: 150px;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(var(--primary-rgb), 0.3) 0%, transparent 70%);
  z-index: 2;
`;

const Title = styled(motion.h1)`
  font-size: 3.5rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  text-shadow: 0 0 10px rgba(var(--primary-rgb), 0.3);
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled(motion.p)`
  font-size: 1.3rem;
  color: var(--text-secondary);
  max-width: 700px;
  margin: 0 auto 3rem;
  line-height: 1.6;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const AnimationContainer = styled(motion.div)`
  width: 100%;
  max-width: 800px;
  margin: 2rem auto 0;
  position: relative;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ScrollIndicator = styled(motion.div)`
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  gap: 8px;
  cursor: pointer;
`;

const FeaturesSection = styled.section`
  width: 100%;
  max-width: 1400px;
  margin: 6rem auto 0;
  padding: 4rem 2rem;
  background: rgba(var(--card-bg-rgb), 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  box-shadow: var(--shadow);
`;

const SectionTitle = styled.h2`
  font-size: 2.5rem;
  color: var(--text-primary);
  margin-bottom: 3rem;
  text-align: center;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 3;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled(motion.div)`
  background-color: rgba(var(--card-bg-rgb), 0.7);
  backdrop-filter: blur(10px);
  padding: 2rem;
  border-radius: 16px;
  box-shadow: var(--shadow);
  text-align: left;
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(var(--primary-rgb), 0.3);
  }
`;

const FeatureIconContainer = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: rgba(var(--primary-rgb), 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  font-size: 2rem;
`;

const FeatureTitle = styled.h3`
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.4rem;
`;

const FeatureDescription = styled.p`
  color: var(--text-secondary);
  line-height: 1.8;
`;

const LandingPage = () => {
  const navigate = useNavigate();
  const particlesContainerRef = useRef(null);
  const [particles, setParticles] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const featuresRef = useRef(null);

  // Create particles - increased count to 120
  useEffect(() => {
    const particlesCount = 120;
    const newParticles = Array.from({ length: particlesCount }).map((_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 6 + 2,
      color: `hsl(${Math.random() * 60 + 200}, 100%, 50%)`,
      velocity: {
        x: Math.random() * 0.5 - 0.25,
        y: Math.random() * 0.5 - 0.25
      }
    }));
    setParticles(newParticles);
  }, []);

  // Handle mouse movement
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Update particles based on mouse position
  useEffect(() => {
    if (particles.length === 0) return;

    const updateParticles = () => {
      setParticles(prevParticles => 
        prevParticles.map(particle => {
          // Calculate distance from mouse
          const dx = mousePosition.x - particle.x;
          const dy = mousePosition.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Apply force inversely proportional to distance
          let newVelocityX = particle.velocity.x;
          let newVelocityY = particle.velocity.y;
          
          if (distance < 200) {
            const force = 0.5 * (1 - distance / 200);
            newVelocityX -= dx * force * 0.01;
            newVelocityY -= dy * force * 0.01;
          }
          
          // Apply velocity with boundaries
          let newX = particle.x + newVelocityX;
          let newY = particle.y + newVelocityY;
          
          // Bounce off walls
          if (newX < 0 || newX > window.innerWidth) {
            newVelocityX *= -1;
            newX = particle.x;
          }
          
          if (newY < 0 || newY > window.innerHeight) {
            newVelocityY *= -1;
            newY = particle.y;
          }
          
          // Add some random movement
          newVelocityX += (Math.random() - 0.5) * 0.05;
          newVelocityY += (Math.random() - 0.5) * 0.05;
          
          // Dampen velocity
          newVelocityX *= 0.98;
          newVelocityY *= 0.98;
          
          return {
            ...particle,
            x: newX,
            y: newY,
            velocity: {
              x: newVelocityX,
              y: newVelocityY
            }
          };
        })
      );
    };

    const animationId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animationId);
  }, [particles, mousePosition]);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      title: 'AI-Powered Proctoring',
      description: 'Advanced facial recognition and behavior analysis to ensure exam integrity with real-time monitoring.',
      icon: '🤖'
    },
    {
      title: 'Real-time Monitoring',
      description: 'Instant alerts for suspicious activities and multiple face detection with comprehensive reporting.',
      icon: '👁️'
    },
    {
      title: 'Secure Environment',
      description: 'Full-screen mode enforcement and tab switching prevention with encrypted data transmission.',
      icon: '🔒'
    },
    {
      title: 'Seamless Integration',
      description: 'Easily integrate with existing LMS platforms, with support for multiple question formats and automated grading.',
      icon: '🔄'
    }
  ];

  return (
    <LandingContainer>
      <ParticlesContainer ref={particlesContainerRef}>
        {particles.map(particle => (
          <Particle
            key={particle.id}
            style={{
              left: particle.x,
              top: particle.y,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `radial-gradient(circle at center, ${particle.color} 0%, transparent 70%)`,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
            }}
            animate={{
              x: [0, Math.random() * 10 - 5],
              y: [0, Math.random() * 10 - 5],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
        ))}
      </ParticlesContainer>

      <NavBar>
        <Logo>
          NeuroWatch
        </Logo>
        <NavButtons>
          <LoginButton
            variant="student"
            onClick={() => navigate('/student-login')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiUser size={18} />
            Student Login
          </LoginButton>
          <LoginButton
            variant="admin"
            onClick={() => navigate('/admin-login')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiShield size={18} />
            Admin Login
          </LoginButton>
        </NavButtons>
      </NavBar>

      <MainContent>
        <HeroSection>
          {/* Robot Animation at the top */}
          <RobotAnimationContainer
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
          >
            <Lottie animationData={robotAnimation} loop={true} />
          </RobotAnimationContainer>
          
          {/* Glowing circle behind the robot */}
          <GlowingCircle
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />

          <Title
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            AI-Powered Exam Proctoring
          </Title>
          <Subtitle
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Secure, intelligent, and reliable online examination platform with advanced proctoring capabilities
            designed to maintain academic integrity in the digital age
          </Subtitle>

          <AnimationContainer
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Lottie animationData={proctorAnimation} loop={true} />
          </AnimationContainer>

          <ScrollIndicator 
            onClick={scrollToFeatures}
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span>Explore Features</span>
            <FiChevronDown size={24} />
          </ScrollIndicator>
        </HeroSection>

        <FeaturesSection ref={featuresRef}>
          <SectionTitle>Key Features</SectionTitle>
          <FeaturesGrid>
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <FeatureIconContainer>
                  <span role="img" aria-label={feature.title}>{feature.icon}</span>
                </FeatureIconContainer>
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </FeaturesSection>
      </MainContent>
    </LandingContainer>
  );
};

export default LandingPage;
