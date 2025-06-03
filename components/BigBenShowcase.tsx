"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface BigBenShowcaseProps {
  targetProgress?: number; // 0-100
  animationDuration?: number; // milliseconds
}

export default function BigBenShowcase({ 
  targetProgress = 100, 
  animationDuration = 3000 
}: BigBenShowcaseProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const bigBenGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const isInitializedRef = useRef(false);

  // Easing function for smooth animation
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Create Big Ben with progressive detail based on progress
  const createBigBen = (progress: number): THREE.Group => {
    const bigBenGroup = new THREE.Group();
    const scale = 1.5; // Increased scale for better visibility
    
    // Colors based on progress
    const baseColor = progress < 100 ? 0x4A5568 : 0xFFD700; // Gray to Gold
    const buildingColor = progress < 100 ? 0x718096 : 0xD4A76A;
    const accentColor = progress < 100 ? 0x2D3748 : 0x8B7355;
    
    // 0% - Show very faint base outline
    if (progress === 0) {
      const baseGeometry = new THREE.BoxGeometry(6 * scale, 2 * scale, 6 * scale);
      const baseEdges = new THREE.EdgesGeometry(baseGeometry);
      const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.1
      }));
      baseLine.position.y = 1 * scale;
      bigBenGroup.add(baseLine);
      return bigBenGroup;
    }
    
    // 25% - Basic outline only
    if (progress >= 25) {
      // Simple box outline for base
      const baseGeometry = new THREE.BoxGeometry(6 * scale, 2 * scale, 6 * scale);
      const baseEdges = new THREE.EdgesGeometry(baseGeometry);
      const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
        color: progress === 100 ? 0xFFD700 : baseColor
      }));
      baseLine.position.y = 1 * scale;
      bigBenGroup.add(baseLine);
      
      // Simple cylinder outline for tower
      const towerGeometry = new THREE.CylinderGeometry(2.5 * scale, 3 * scale, 20 * scale, 4); // Less segments
      const towerEdges = new THREE.EdgesGeometry(towerGeometry);
      const towerLine = new THREE.LineSegments(towerEdges, new THREE.LineBasicMaterial({ 
        color: progress === 100 ? 0xFFD700 : buildingColor
      }));
      towerLine.position.y = 12 * scale;
      bigBenGroup.add(towerLine);
    }
    
    // 50% - Add main structural lines
    if (progress >= 50) {
      // More detailed tower
      const detailedTowerGeometry = new THREE.CylinderGeometry(2.5 * scale, 3 * scale, 20 * scale, 8);
      const detailedTowerEdges = new THREE.EdgesGeometry(detailedTowerGeometry);
      const detailedTowerLine = new THREE.LineSegments(detailedTowerEdges, new THREE.LineBasicMaterial({ 
        color: progress === 100 ? 0xFFD700 : buildingColor
      }));
      detailedTowerLine.position.y = 12 * scale;
      bigBenGroup.add(detailedTowerLine);
      
      // Clock section box
      const clockGeometry = new THREE.BoxGeometry(6 * scale, 4 * scale, 6 * scale);
      const clockEdges = new THREE.EdgesGeometry(clockGeometry);
      const clockLine = new THREE.LineSegments(clockEdges, new THREE.LineBasicMaterial({ 
        color: progress === 100 ? 0xFFD700 : buildingColor
      }));
      clockLine.position.y = 20 * scale;
      bigBenGroup.add(clockLine);
    }
    
    // 75% - Add detailed features
    if (progress >= 75) {
      // Clock faces
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const clockFaceGeometry = new THREE.CircleGeometry(2.5 * scale, 16);
        const clockFaceEdges = new THREE.EdgesGeometry(clockFaceGeometry);
        const clockFaceLine = new THREE.LineSegments(clockFaceEdges, new THREE.LineBasicMaterial({ 
          color: progress === 100 ? 0xFFD700 : buildingColor
        }));
        clockFaceLine.position.y = 20 * scale;
        clockFaceLine.position.x = Math.cos(angle) * 3.01 * scale;
        clockFaceLine.position.z = Math.sin(angle) * 3.01 * scale;
        clockFaceLine.lookAt(0, 20 * scale, 0);
        bigBenGroup.add(clockFaceLine);
        
        // Clock hands
        if (progress >= 90) {
          const handGroup = new THREE.Group();
          
          // Hour hand
          const hourHandGeometry = new THREE.BoxGeometry(0.2 * scale, 1.5 * scale, 0.1);
          const hourHandEdges = new THREE.EdgesGeometry(hourHandGeometry);
          const hourHandLine = new THREE.LineSegments(hourHandEdges, new THREE.LineBasicMaterial({ 
            color: progress === 100 ? 0xFFD700 : accentColor
          }));
          hourHandLine.position.y = 0.75 * scale;
          handGroup.add(hourHandLine);
          
          // Minute hand
          const minuteHandGeometry = new THREE.BoxGeometry(0.15 * scale, 2 * scale, 0.1);
          const minuteHandEdges = new THREE.EdgesGeometry(minuteHandGeometry);
          const minuteHandLine = new THREE.LineSegments(minuteHandEdges, new THREE.LineBasicMaterial({ 
            color: progress === 100 ? 0xFFD700 : accentColor
          }));
          minuteHandLine.position.y = 1 * scale;
          minuteHandLine.rotation.z = Math.PI / 2;
          handGroup.add(minuteHandLine);
          
          handGroup.position.y = 20 * scale;
          handGroup.position.x = Math.cos(angle) * 3.02 * scale;
          handGroup.position.z = Math.sin(angle) * 3.02 * scale;
          handGroup.lookAt(0, 20 * scale, 0);
          bigBenGroup.add(handGroup);
        }
      }
      
      // Spire
      const spireGeometry = new THREE.ConeGeometry(1.5 * scale, 8 * scale, 6);
      const spireEdges = new THREE.EdgesGeometry(spireGeometry);
      const spireLine = new THREE.LineSegments(spireEdges, new THREE.LineBasicMaterial({ 
        color: progress === 100 ? 0xFFD700 : buildingColor
      }));
      spireLine.position.y = 30 * scale;
      bigBenGroup.add(spireLine);
      
      // Decorative elements at 85%+
      if (progress >= 85) {
        // Tower windows
        for (let j = 0; j < 3; j++) {
          for (let i = 0; i < 4; i++) {
            const windowAngle = (Math.PI / 2) * i + Math.PI / 4;
            const windowGeometry = new THREE.PlaneGeometry(0.8 * scale, 1.2 * scale);
            const windowEdges = new THREE.EdgesGeometry(windowGeometry);
            const windowLine = new THREE.LineSegments(windowEdges, new THREE.LineBasicMaterial({ 
              color: progress === 100 ? 0xFFD700 : accentColor
            }));
            windowLine.position.x = Math.cos(windowAngle) * 2.7 * scale;
            windowLine.position.z = Math.sin(windowAngle) * 2.7 * scale;
            windowLine.position.y = (8 + j * 4) * scale;
            windowLine.lookAt(0, windowLine.position.y, 0);
            bigBenGroup.add(windowLine);
          }
        }
      }
    }
    
    // 100% - Add golden particles
    if (progress === 100) {
      const particleCount = 30;
      const particlesGeometry = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = (8 + Math.random() * 4) * scale;
        const height = Math.random() * 40 * scale;
        
        particlePositions[i * 3] = Math.cos(angle) * radius;
        particlePositions[i * 3 + 1] = height;
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particlesMaterial = new THREE.PointsMaterial({
        color: 0xFFD700,
        size: 0.3,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      
      const particles = new THREE.Points(particlesGeometry, particlesMaterial);
      particlesRef.current = particles;
      bigBenGroup.add(particles);
    }
    
    return bigBenGroup;
  };

  useEffect(() => {
    if (!mountRef.current || isInitializedRef.current) return;
    
    isInitializedRef.current = true;

    // Get container dimensions
    const containerWidth = mountRef.current.clientWidth || 400;
    const containerHeight = mountRef.current.clientHeight || 400;


    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera - more dramatic angle
    const camera = new THREE.PerspectiveCamera(
      35,
      containerWidth / containerHeight,
      0.1,
      200
    );
    // Lower camera angle for more dramatic upward view
    camera.position.set(70, 35, 100);
    camera.lookAt(0, 20, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minPolarAngle = Math.PI / 6;
    controls.enableRotate = true; // Enable rotation for autoRotate to work
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0; // Increase speed
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.set(0, 20, 0);
    controls.update(); // Initial update
    controlsRef.current = controls;

    // Lights - increased intensity for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, 20, -10);
    scene.add(directionalLight2);
    
    const pointLight = new THREE.PointLight(0xffd700, 0.5, 50);
    pointLight.position.set(0, 25, 0);
    scene.add(pointLight);

    // Ground reference - larger grid for more distant view
    const gridHelper = new THREE.GridHelper(50, 20, 0x444444, 0x222222);
    gridHelper.position.y = -2;
    scene.add(gridHelper);


    // Initial Big Ben - start with current progress or targetProgress
    const initialProgress = progressRef.current || targetProgress;
    const initialBigBen = createBigBen(initialProgress);
    initialBigBen.position.y = -2;
    bigBenGroupRef.current = initialBigBen;
    scene.add(initialBigBen);
    
    // Set initial progress
    progressRef.current = initialProgress;
    setCurrentProgress(initialProgress);

    // Animation
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      // Update controls for auto rotation
      controlsRef.current.update();
      
      // Manual rotation fallback (in case autoRotate isn't working)
      if (bigBenGroupRef.current) {
        bigBenGroupRef.current.rotation.y += 0.005;
      }
      
      // Animate particles
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length / 3; i++) {
          positions[i * 3 + 1] += 0.05;
          if (positions[i * 3 + 1] > 40 * 1.2) {
            positions[i * 3 + 1] = 0;
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Dispose controls
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      // Dispose renderer
      if (rendererRef.current) {
        if (mountRef.current && rendererRef.current.domElement.parentElement === mountRef.current) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      // Dispose scene
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
          if (object instanceof THREE.LineSegments) {
            object.geometry?.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      
      // Reset refs
      cameraRef.current = null;
      bigBenGroupRef.current = null;
      particlesRef.current = null;
      isInitializedRef.current = false;
    };
  }, [targetProgress]); // Include targetProgress to use initial value

  // Animate progress changes
  useEffect(() => {
    if (!sceneRef.current || !bigBenGroupRef.current) return;

    const startProgress = progressRef.current;
    const endProgress = targetProgress;
    startTimeRef.current = Date.now();

    const updateProgress = () => {
      if (!startTimeRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / animationDuration, 1);
      const easedProgress = easeInOutCubic(progress);
      const currentValue = startProgress + (endProgress - startProgress) * easedProgress;
      
      progressRef.current = currentValue;
      setCurrentProgress(Math.round(currentValue));

      // Remove old Big Ben and create new one with updated progress
      if (sceneRef.current && bigBenGroupRef.current) {
        sceneRef.current.remove(bigBenGroupRef.current);
        const newBigBen = createBigBen(Math.round(currentValue));
        newBigBen.position.y = -2;
        bigBenGroupRef.current = newBigBen;
        sceneRef.current.add(newBigBen);
      }

      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
  }, [targetProgress, animationDuration]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg">
      <div 
        ref={mountRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {/* Progress indicator */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
        {currentProgress}% 完成
      </div>
      {/* Debug fallback */}
      {!rendererRef.current && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-6xl mb-4">🕰️</div>
            <p>Big Ben 3D モデル準備中...</p>
          </div>
        </div>
      )}
    </div>
  );
}