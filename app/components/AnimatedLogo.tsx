'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface AnimatedLogoProps {
  videoSrc: string;
  fallbackImageSrc: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  loop?: boolean;
  playOnce?: boolean;
}

// Detect iOS (Safari, Chrome on iOS, etc.)
const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export default function AnimatedLogo({
  videoSrc,
  fallbackImageSrc,
  alt,
  width = 60,
  height = 24,
  className = '',
  style = {},
  loop = false,
  playOnce = true,
}: AnimatedLogoProps) {
  const [showVideo, setShowVideo] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);
  const [staticOpacity, setStaticOpacity] = useState(0);
  const [isiOSDevice, setIsiOSDevice] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Detect iOS on mount
  useEffect(() => {
    setIsiOSDevice(isIOS());
  }, []);

  // Preload the static image so it's ready immediately when needed
  useEffect(() => {
    const img = new window.Image();
    img.src = fallbackImageSrc;
  }, [fallbackImageSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasPlayed) return;

    // Wait for video to be ready before playing
    const handleCanPlay = () => {
      setIsVideoReady(true);
      video.play().catch((error) => {
        console.log('Autoplay prevented:', error);
        setShowVideo(false);
        // iOS fallback: show static image if autoplay fails
        setStaticOpacity(1);
      });
    };

    // Start fading out 0.3s before video ends
    const handleTimeUpdate = () => {
      if (video.duration && video.currentTime >= video.duration - 0.3) {
        const remainingTime = video.duration - video.currentTime;
        const opacity = remainingTime / 0.3; // Fade from 1 to 0 over 0.3s
        setVideoOpacity(Math.max(0, opacity));
        setStaticOpacity(1 - Math.max(0, opacity)); // Fade in static as video fades out
      }
    };

    // If video is already loaded, play immediately
    if (video.readyState >= 3) {
      handleCanPlay();
    } else {
      video.addEventListener('canplay', handleCanPlay);
    }

    video.addEventListener('timeupdate', handleTimeUpdate);

    // iOS-specific: Fallback timeout - if video doesn't become ready in 2s, show static image
    let iosTimeout: NodeJS.Timeout | null = null;
    if (isiOSDevice) {
      iosTimeout = setTimeout(() => {
        if (!isVideoReady) {
          console.log('iOS fallback: Video not ready after 2s, showing static image');
          setStaticOpacity(1);
          setVideoOpacity(0);
        }
      }, 2000);
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (iosTimeout) clearTimeout(iosTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPlayed, isiOSDevice, isVideoReady]);

  const handleVideoEnd = () => {
    if (playOnce) {
      setHasPlayed(true);
      // Keep video visible but transparent to show static image underneath
    }
  };

  const handleVideoError = () => {
    // Fallback to static image on error
    setShowVideo(false);
  };

  // iOS-specific container styles for GPU acceleration and explicit dimensions
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width,
    height,
    // iOS fix: explicit min dimensions to prevent collapse
    ...(isiOSDevice && {
      minWidth: width,
      minHeight: height,
      // GPU acceleration hint for iOS WebKit
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)',
      // Ensure visibility
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
    }),
  };

  // iOS-specific media styles
  const getMediaStyle = (baseOpacity: number): React.CSSProperties => ({
    ...style,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    opacity: baseOpacity,
    // iOS fix: explicit dimensions instead of relying on width/height attributes
    ...(isiOSDevice && {
      width: `${width}px`,
      height: `${height}px`,
      minWidth: `${width}px`,
      minHeight: `${height}px`,
    }),
  });

  return (
    <div style={containerStyle}>
      {/* Static image layer - always underneath, fades in as video fades out */}
      <Image
        src={fallbackImageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`${className} transition-opacity duration-300`}
        style={getMediaStyle(staticOpacity)}
        priority={isiOSDevice} // Prioritize loading on iOS
      />
      
      {/* Video layer - fades out on top */}
      {showVideo && (
        <video
          ref={videoRef}
          src={videoSrc}
          width={width}
          height={height}
          className={`${className} transition-opacity duration-300`}
          style={{
            ...getMediaStyle(isVideoReady ? videoOpacity : 0),
            objectFit: 'contain',
            mixBlendMode: 'screen',
          }}
          autoPlay
          muted
          playsInline
          loop={loop}
          preload="auto"
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          aria-label={alt}
        />
      )}
    </div>
  );
}
