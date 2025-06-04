"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  createBigBen_three,
  createEiffelTower_three,
  createColosseum_three,
  createSagradaFamilia_three,
  createWindmill_three,
  createBrandenburgGate_three
} from '@/utils/background';

export default function BackgroundBuildings() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const buildingsGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // ResizeObserverを使用してコンテナのサイズ変更を検知
  useEffect(() => {
    if (!mountRef.current) return;

    console.log('BackgroundBuildings: Initializing 3D scene');

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera - dynamically adjust FOV based on screen width
    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
    
    // For narrow screens: moderate FOV to show 4 buildings
    // For wide screens: wide FOV to show all 6 buildings
    const baseFOV = aspect < 1 ? 65 : 75; // Narrow screens get moderate FOV
    
    const camera = new THREE.PerspectiveCamera(
      baseFOV,
      aspect,
      0.1,
      1000
    );
    
    // Adjust camera distance based on aspect ratio
    const baseDistance = aspect < 1 ? 250 : 200; // Move back for narrow screens
    camera.position.set(0, 60, baseDistance);
    camera.lookAt(0, 20, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // Transparent background
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights - warm night scene atmosphere
    const ambientLight = new THREE.AmbientLight(0x4a3a28, 0.4); // Dim warm ambient for night
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xFFD4A3, 0.5); // Warm street lamp color
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xFFA366, 0.4); // Warmer orange light
    directionalLight2.position.set(-50, 100, -50);
    scene.add(directionalLight2);

    // Create buildings group
    const buildingsGroup = new THREE.Group();
    buildingsGroupRef.current = buildingsGroup;
    scene.add(buildingsGroup);

    // Building configurations - keep consistent radius
    const baseRadius = 150;
    const radius = baseRadius; // Keep radius fixed
    
    const buildings = [
      { create: createBigBen_three, scale: 3.5, angle: 0 },  // Front center
      { create: createEiffelTower_three, scale: 3.0, angle: Math.PI / 3 }, // Will be cut off on narrow screens
      { create: createColosseum_three, scale: 3.5, angle: 2 * Math.PI / 3 }, // Will be cut off on narrow screens
      { create: createSagradaFamilia_three, scale: 3.2, angle: Math.PI }, // Back center
      { create: createWindmill_three, scale: 3.0, angle: 4 * Math.PI / 3 }, // Left side
      { create: createBrandenburgGate_three, scale: 3.5, angle: 5 * Math.PI / 3 } // Right side
    ];

    // Create and position buildings
    buildings.forEach((config, index) => {
      try {
        const building = config.create();
        
        // Set 25% completion - show only level0
        ['level0', 'level1', 'level2', 'level3', 'level4'].forEach((levelName, levelIndex) => {
          if (building.userData[levelName]) {
            // Only show level0 for 25% completion
            building.userData[levelName].visible = levelIndex === 0;
            
            // Change colors to warm light like night street lamps
            building.userData[levelName].traverse((child: any) => {
              if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
                if (child.material) {
                  // Warm street lamp color for night scene
                  child.material.color = new THREE.Color(0xFFD4A3); // Warm yellow-orange like street lamps
                  // Moderate opacity for subtle glow
                  child.material.opacity = 0.7;
                  child.material.transparent = true;
                }
              }
              if (child instanceof THREE.Mesh) {
                if (child.material) {
                  child.material.color = new THREE.Color(0xFFD4A3); // Warm yellow-orange like street lamps
                  child.material.opacity = 0.7;
                  child.material.transparent = true;
                }
              }
            });
          }
        });

        building.scale.setScalar(config.scale);
        // Position in a circle
        const x = Math.cos(config.angle) * radius;
        const z = Math.sin(config.angle) * radius;
        building.position.set(x, 0, z);
        // Make building face the center
        building.lookAt(0, building.position.y, 0);
        buildingsGroup.add(building);
      } catch (error) {
        console.error(`Error creating building ${index}:`, error);
      }
    });

    // Grid helper removed for cleaner look

    // Animation
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Rotate buildings group slowly
      if (buildingsGroupRef.current) {
        buildingsGroupRef.current.rotation.y += 0.003; // Faster rotation for better visibility
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize with ResizeObserver for better responsiveness
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current || !buildingsGroupRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const aspect = width / height;
      
      console.log('BackgroundBuildings: Resizing to', width, 'x', height, 'aspect:', aspect);
      
      // Dynamically adjust FOV and camera position based on aspect ratio
      // Goal: Show 4 buildings on narrow screens, all 6 on wide screens
      if (aspect < 1) {
        // Portrait/narrow - show 4 buildings with moderate FOV
        cameraRef.current.fov = 65;
        cameraRef.current.position.set(0, 60, 250); // Move camera back
      } else if (aspect < 1.5) {
        // Medium width - show 5 buildings
        cameraRef.current.fov = 70;
        cameraRef.current.position.set(0, 60, 220);
      } else {
        // Wide - show all 6 buildings
        cameraRef.current.fov = 75;
        cameraRef.current.position.set(0, 60, 200);
      }
      
      // Don't reposition buildings - let FOV changes handle visibility
      
      cameraRef.current.aspect = aspect;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    resizeObserver.observe(mountRef.current);
    
    // Also listen to window resize for good measure
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="fixed inset-0 w-full h-full opacity-50 z-0 pointer-events-none"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} // Explicit positioning for better resize detection
    />
  );
}