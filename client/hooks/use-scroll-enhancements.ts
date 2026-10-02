"use client";

import { useEffect, useState, useCallback } from "react";

export function useScrollEnhancements() {
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  const updateScrollValues = useCallback(() => {
    const currentScrollY = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = documentHeight > 0 ? (currentScrollY / documentHeight) * 100 : 0;

    setScrollY(currentScrollY);
    setScrollProgress(progress);
    setIsScrolled(currentScrollY > 50);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(updateScrollValues);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollValues(); // Initial call

    return () => window.removeEventListener("scroll", handleScroll);
  }, [updateScrollValues]);

  return { scrollY, scrollProgress, isScrolled };
}

export function useScrollReveal() {
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
        }
      });
    }, observerOptions);

    // Observe all scroll reveal elements
    const scrollRevealElements = document.querySelectorAll(
      ".scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale"
    );

    scrollRevealElements.forEach((el) => observer.observe(el));

    return () => {
      scrollRevealElements.forEach((el) => observer.unobserve(el));
    };
  }, []);
}

export function useSmoothScroll() {
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offsetTop = element.offsetTop - 80; // Account for fixed navigation
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  }, []);

  return { scrollToSection };
}

export function useParallax(speed: number = 0.5) {
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(() => {
        setOffsetY(window.scrollY * speed);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed]);

  return offsetY;
}
