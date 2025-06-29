import * as THREE from 'three';
import { BuildingConfig, BuildingElement } from '../3d-building-factory';

export function getBigBenConfig(): BuildingConfig {
  return {
    type: 'tower',
    buildingColor: '#8B7355',
    accentColor: '#FFD700',
    levels: [
      // Level 0: Basic structure (0%)
      {
        visibilityThreshold: 0,
        elements: [
          // Base
          {
            type: 'box',
            position: { x: 0, y: 1, z: 0 },
            scale: { x: 6, y: 2, z: 6 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          // Tower
          {
            type: 'cylinder',
            position: { x: 0, y: 12, z: 0 },
            scale: { x: 2.5, y: 3, z: 20 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          // Clock box
          {
            type: 'box',
            position: { x: 0, y: 20, z: 0 },
            scale: { x: 6, y: 4, z: 6 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          // Belfry
          {
            type: 'cylinder',
            position: { x: 0, y: 24, z: 0 },
            scale: { x: 2, y: 2.5, z: 4 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          // Spire
          {
            type: 'cone',
            position: { x: 0, y: 30, z: 0 },
            scale: { x: 1.5, y: 8, z: 1.5 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          }
        ]
      },
      // Level 1: Clock faces and numbers (20%)
      {
        visibilityThreshold: 20,
        elements: [
          // Clock faces (4 sides)
          ...Array.from({ length: 4 }, (_, i) => {
            const angle = (Math.PI / 2) * i;
            const radius = 3.01;
            return [
              // Clock face circle
              {
                type: 'custom',
                geometry: new THREE.CircleGeometry(2.5, 32),
                position: { 
                  x: Math.cos(angle) * radius,
                  y: 20,
                  z: Math.sin(angle) * radius
                },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'line',
                opacity: 0
              } as BuildingElement,
              // Inner circle
              {
                type: 'custom',
                geometry: new THREE.CircleGeometry(2, 24),
                position: { 
                  x: Math.cos(angle) * radius,
                  y: 20,
                  z: Math.sin(angle) * radius
                },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'line',
                opacity: 0
              } as BuildingElement,
              // Hour markers
              ...Array.from({ length: 12 }, (_, hour) => {
                const hourAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
                return {
                  type: 'box',
                  position: {
                    x: Math.cos(angle) * radius + Math.cos(hourAngle) * 2.2 * Math.cos(angle),
                    y: 20 + Math.sin(hourAngle) * 2.2,
                    z: Math.sin(angle) * radius + Math.cos(hourAngle) * 2.2 * Math.sin(angle)
                  },
                  scale: { x: 0.1, y: 0.4, z: 0.1 },
                  material: 'mesh',
                  useAccentColor: true,
                  opacity: 0
                } as BuildingElement;
              })
            ];
          }).flat()
        ]
      },
      // Level 2: Gothic windows and decoration (40%)
      {
        visibilityThreshold: 40,
        elements: [
          // Gothic windows
          ...Array.from({ length: 4 }, (_, i) => {
            const angle = (Math.PI / 2) * i;
            return Array.from({ length: 6 }, (_, j) => {
              const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.3, 0, 0),
                new THREE.Vector3(-0.3, 0.8, 0),
                new THREE.Vector3(0, 1.2, 0),
                new THREE.Vector3(0.3, 0.8, 0),
                new THREE.Vector3(0.3, 0, 0)
              ]);
              const points = curve.getPoints(20);
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              
              return {
                type: 'custom',
                geometry,
                position: {
                  x: Math.cos(angle) * 2.8,
                  y: 3 + j * 2.5,
                  z: Math.sin(angle) * 2.8
                },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'line',
                useAccentColor: true,
                opacity: 0
              } as BuildingElement;
            });
          }).flat(),
          // Decorative cornices
          ...Array.from({ length: 3 }, (_, level) => ({
            type: 'torus',
            position: { x: 0, y: 8 + level * 8, z: 0 },
            scale: { x: 3 - level * 0.3, y: 0.2, z: 3 - level * 0.3 },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            material: 'line',
            opacity: 0
          } as BuildingElement))
        ]
      },
      // Level 3: Moving clock hands and bell (60%)
      {
        visibilityThreshold: 60,
        elements: [
          // Clock hands for each face
          ...Array.from({ length: 4 }, (_, side) => {
            const angle = (Math.PI / 2) * side;
            const radius = 3.02;
            return [
              // Hour hand
              {
                type: 'box',
                position: {
                  x: Math.cos(angle) * radius,
                  y: 20,
                  z: Math.sin(angle) * radius
                },
                scale: { x: 0.3, y: 1.8, z: 0.15 },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'mesh',
                color: 0x000000,
                opacity: 0
              } as BuildingElement,
              // Minute hand
              {
                type: 'box',
                position: {
                  x: Math.cos(angle) * radius,
                  y: 20,
                  z: Math.sin(angle) * radius
                },
                scale: { x: 0.2, y: 2.2, z: 0.15 },
                rotation: { x: 0, y: angle, z: Math.PI / 3 },
                material: 'mesh',
                color: 0x000000,
                opacity: 0
              } as BuildingElement,
              // Center dot
              {
                type: 'sphere',
                position: {
                  x: Math.cos(angle) * radius,
                  y: 20,
                  z: Math.sin(angle) * radius
                },
                scale: { x: 0.3, y: 0.3, z: 0.3 },
                material: 'mesh',
                useAccentColor: true,
                opacity: 0
              } as BuildingElement
            ];
          }).flat(),
          // Bell
          {
            type: 'sphere',
            position: { x: 0, y: 24, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            material: 'mesh',
            wireframe: true,
            useAccentColor: true,
            opacity: 0
          }
        ],
        animations: [
          // Clock hand animations would be added here
        ]
      },
      // Level 4: Ornate decorative details (80%)
      {
        visibilityThreshold: 80,
        elements: [
          // Pinnacles around belfry
          ...Array.from({ length: 8 }, (_, i) => {
            const angle = (Math.PI * 2 / 8) * i;
            return [
              // Pinnacle cone
              {
                type: 'cone',
                position: {
                  x: Math.cos(angle) * 3.5,
                  y: 23,
                  z: Math.sin(angle) * 3.5
                },
                scale: { x: 0.4, y: 2, z: 0.4 },
                material: 'mesh',
                opacity: 0
              } as BuildingElement,
              // Orb on top
              {
                type: 'sphere',
                position: {
                  x: Math.cos(angle) * 3.5,
                  y: 24.2,
                  z: Math.sin(angle) * 3.5
                },
                scale: { x: 0.2, y: 0.2, z: 0.2 },
                material: 'mesh',
                useAccentColor: true,
                opacity: 0
              } as BuildingElement
            ];
          }).flat(),
          // Crown
          {
            type: 'torus',
            position: { x: 0, y: 34, z: 0 },
            scale: { x: 1, y: 0.3, z: 1 },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            material: 'mesh',
            wireframe: true,
            useAccentColor: true,
            opacity: 0
          },
          // Flag pole
          {
            type: 'cylinder',
            position: { x: 0, y: 35, z: 0 },
            scale: { x: 0.05, y: 0.05, z: 2 },
            material: 'mesh',
            opacity: 0
          }
        ]
      }
    ]
  };
}