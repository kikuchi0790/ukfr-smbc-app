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

  useEffect(() => {
    if (!mountRef.current) return;

    console.log('BackgroundBuildings: Initializing 3D scene');

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera - wider angle to see all buildings
    const camera = new THREE.PerspectiveCamera(
      90, // Wider FOV to see more buildings
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 80, 200); // Closer for better visibility
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

    // Building configurations - arranged in a wider circle
    const radius = 200; // Increased radius for better spacing
    const buildings = [
      { create: createBigBen_three, scale: 3.5, angle: 0 },
      { create: createEiffelTower_three, scale: 3.0, angle: Math.PI / 3 },
      { create: createColosseum_three, scale: 3.5, angle: 2 * Math.PI / 3 },
      { create: createSagradaFamilia_three, scale: 3.2, angle: Math.PI },
      { create: createWindmill_three, scale: 3.0, angle: 4 * Math.PI / 3 },
      { create: createBrandenburgGate_three, scale: 3.5, angle: 5 * Math.PI / 3 }
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
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="fixed inset-0 w-full h-full opacity-50 z-0 pointer-events-none" // Fixed positioning with z-0, increased opacity, no pointer events
    />
  );
}