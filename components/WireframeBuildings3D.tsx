"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Category } from '@/types';

interface BuildingData {
  id: string;
  name: string;
  nameJa: string;
  icon: string;
  category: Category;
  description: string;
  position: { x: number; y: number; z: number };
  buildingColor: number;
  accentColor: number;
  detailColor?: number;
  scale: number;
}

interface WireframeBuildings3DProps {
  progress: Record<Category, { answeredQuestions: number; totalQuestions: number; correctAnswers?: number }>;
}

export default function WireframeBuildings3D({ progress }: WireframeBuildings3DProps) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const buildingsRef = useRef<Map<string, THREE.Group>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(null);
  const particlesRef = useRef<Map<string, THREE.Points>>(new Map());
  const isInitializedRef = useRef(false);

  const buildings: BuildingData[] = [
    {
      id: 'bigben',
      name: 'Big Ben',
      nameJa: 'ビッグ・ベン',
      icon: '🕰️',
      category: 'The Regulatory Environment',
      description: '時を刻む規制の基礎',
      position: { x: -15, y: 0, z: 10 },
      buildingColor: 0xD4A76A,
      accentColor: 0x8B7355,
      scale: 0.8
    },
    {
      id: 'eiffel',
      name: 'Eiffel Tower',
      nameJa: 'エッフェル塔',
      icon: '🗼',
      category: 'The Financial Services and Markets Act 2000 and Financial Services Act 2012',
      description: '金融法の鉄骨構造',
      position: { x: 0, y: 0, z: 0 },
      buildingColor: 0x4A4A4A,
      accentColor: 0xFFD700,
      scale: 1
    },
    {
      id: 'colosseum',
      name: 'Colosseum',
      nameJa: 'コロッセオ',
      icon: '🏛️',
      category: 'Associated Legislation and Regulation',
      description: '古代の知恵と現代規制の融合',
      position: { x: 15, y: 0, z: 10 },
      buildingColor: 0xF4E4C1,
      accentColor: 0xB8956A,
      scale: 0.7
    },
    {
      id: 'sagrada',
      name: 'Sagrada Família',
      nameJa: 'サグラダ・ファミリア',
      icon: '⛪',
      category: 'The FCA Conduct of Business Sourcebook/Client Assets',
      description: '実務行動の緻密な詳細',
      position: { x: -15, y: 0, z: -10 },
      buildingColor: 0xE8D7C3,
      accentColor: 0xFF6B6B,
      detailColor: 0x4ECDC4,
      scale: 0.9
    },
    {
      id: 'windmill',
      name: 'Dutch Windmill',
      nameJa: 'オランダ風車',
      icon: '🌬️',
      category: 'Complaints and Redress',
      description: '問題を解決へと導く風',
      position: { x: 0, y: 0, z: -20 },
      buildingColor: 0x8B4513,
      accentColor: 0xFFF8DC,
      scale: 0.6
    },
    {
      id: 'brandenburg',
      name: 'Brandenburg Gate',
      nameJa: 'ブランデンブルク門',
      icon: '🚪',
      category: 'Regulations: Final Study Questions',
      description: '資格認定への門',
      position: { x: 15, y: 0, z: -10 },
      buildingColor: 0xDDD5C7,
      accentColor: 0xB8860B,
      scale: 0.7
    }
  ];

  const getProgressPercentage = (category: Category): number => {
    const categoryProgress = progress[category];
    if (!categoryProgress || categoryProgress.totalQuestions === 0) return 0;
    // Use correct answers instead of answered questions
    return Math.round(((categoryProgress.correctAnswers || 0) / categoryProgress.totalQuestions) * 100);
  };

  // Create celebration particles for 100% completion
  const createCelebrationParticles = (position: THREE.Vector3): THREE.Points => {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x + (Math.random() - 0.5) * 2;
      positions[i3 + 1] = position.y + Math.random() * 5;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;
      
      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = Math.random() * 0.2 + 0.1;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xFFD700,
      size: 0.3,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.lifetime = 0;
    return particles;
  };

  // Create building geometries
  const createBigBen = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    
    // Base structure (always visible)
    const baseGeometry = new THREE.BoxGeometry(6, 2, 6);
    const baseEdges = new THREE.EdgesGeometry(baseGeometry);
    const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5 
    }));
    baseLine.position.y = 1;
    group.add(baseLine);
    
    // Tower (visible at 25%+)
    if (progressPercent >= 25) {
      const towerGeometry = new THREE.CylinderGeometry(2.5, 3, 20, 8);
      const towerEdges = new THREE.EdgesGeometry(towerGeometry);
      const towerLine = new THREE.LineSegments(towerEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 25) / 25)
      }));
      towerLine.position.y = 12;
      group.add(towerLine);
    }
    
    // Clock section (visible at 50%+)
    if (progressPercent >= 50) {
      const clockGeometry = new THREE.BoxGeometry(6, 4, 6);
      const clockEdges = new THREE.EdgesGeometry(clockGeometry);
      const clockLine = new THREE.LineSegments(clockEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 50) / 25)
      }));
      clockLine.position.y = 20;
      group.add(clockLine);
      
      // Clock face
      const clockFaceGeometry = new THREE.CircleGeometry(2.5, 32);
      const clockFaceEdges = new THREE.EdgesGeometry(clockFaceGeometry);
      const clockFaceLine = new THREE.LineSegments(clockFaceEdges, new THREE.LineBasicMaterial({ 
        color: accentColor,
        opacity: Math.min(1, (progressPercent - 50) / 25)
      }));
      clockFaceLine.position.y = 20;
      clockFaceLine.position.z = 3.01;
      group.add(clockFaceLine);
    }
    
    // Spire (visible at 75%+)
    if (progressPercent >= 75) {
      const spireGeometry = new THREE.ConeGeometry(1.5, 8, 8);
      const spireEdges = new THREE.EdgesGeometry(spireGeometry);
      const spireLine = new THREE.LineSegments(spireEdges, new THREE.LineBasicMaterial({ 
        color: progressPercent === 100 ? 0xFFD700 : buildingColor,
        opacity: Math.min(1, (progressPercent - 75) / 25)
      }));
      spireLine.position.y = 30;
      group.add(spireLine);
    }
    
    return group;
  };

  const createEiffelTower = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    
    // Base legs (always visible)
    const baseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, 0, 0),
      new THREE.Vector3(-2, 10, 0),
      new THREE.Vector3(-1, 20, 0),
      new THREE.Vector3(0, 30, 0)
    ]);
    
    const points = baseCurve.getPoints(50);
    const baseGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const baseLine = new THREE.Line(baseGeometry, new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.3
    }));
    group.add(baseLine);
    
    // Mirror for other legs
    for (let i = 0; i < 4; i++) {
      const leg = baseLine.clone();
      leg.rotation.y = (Math.PI / 2) * i;
      group.add(leg);
    }
    
    // Middle section (visible at 33%+)
    if (progressPercent >= 33) {
      const middleGeometry = new THREE.BoxGeometry(8, 4, 8);
      const middleEdges = new THREE.EdgesGeometry(middleGeometry);
      const middleLine = new THREE.LineSegments(middleEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 33) / 33)
      }));
      middleLine.position.y = 15;
      group.add(middleLine);
    }
    
    // Top section (visible at 66%+)
    if (progressPercent >= 66) {
      const topGeometry = new THREE.CylinderGeometry(1, 3, 15, 4);
      const topEdges = new THREE.EdgesGeometry(topGeometry);
      const topLine = new THREE.LineSegments(topEdges, new THREE.LineBasicMaterial({ 
        color: progressPercent === 100 ? accentColor : buildingColor,
        opacity: Math.min(1, (progressPercent - 66) / 34)
      }));
      topLine.position.y = 25;
      group.add(topLine);
    }
    
    return group;
  };

  const createColosseum = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    
    // Base structure (always visible)
    const baseRadius = 8;
    const baseHeight = 1;
    const baseGeometry = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.1, baseHeight, 32, 1, true);
    const baseEdges = new THREE.EdgesGeometry(baseGeometry);
    const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5 
    }));
    baseLine.position.y = baseHeight / 2;
    group.add(baseLine);
    
    // First tier (visible at 25%+)
    if (progressPercent >= 25) {
      const tier1Height = 4;
      const tier1Geometry = new THREE.CylinderGeometry(baseRadius * 0.95, baseRadius, tier1Height, 32, 1, true);
      const tier1Edges = new THREE.EdgesGeometry(tier1Geometry);
      const tier1Line = new THREE.LineSegments(tier1Edges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 25) / 25)
      }));
      tier1Line.position.y = baseHeight + tier1Height / 2;
      group.add(tier1Line);
      
      // Arches
      const archCount = 16;
      for (let i = 0; i < archCount; i++) {
        const angle = (i / archCount) * Math.PI * 2;
        const archGeometry = new THREE.TorusGeometry(0.5, 0.1, 4, 8, Math.PI);
        const archEdges = new THREE.EdgesGeometry(archGeometry);
        const archLine = new THREE.LineSegments(archEdges, new THREE.LineBasicMaterial({ 
          color: accentColor,
          opacity: Math.min(1, (progressPercent - 25) / 25)
        }));
        archLine.position.x = Math.cos(angle) * (baseRadius - 0.5);
        archLine.position.z = Math.sin(angle) * (baseRadius - 0.5);
        archLine.position.y = baseHeight + tier1Height / 2;
        archLine.rotation.y = angle;
        group.add(archLine);
      }
    }
    
    // Second tier (visible at 50%+)
    if (progressPercent >= 50) {
      const tier2Height = 3;
      const tier2Geometry = new THREE.CylinderGeometry(baseRadius * 0.85, baseRadius * 0.95, tier2Height, 32, 1, true);
      const tier2Edges = new THREE.EdgesGeometry(tier2Geometry);
      const tier2Line = new THREE.LineSegments(tier2Edges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 50) / 25)
      }));
      tier2Line.position.y = baseHeight + 4 + tier2Height / 2;
      group.add(tier2Line);
    }
    
    // Top tier (visible at 75%+)
    if (progressPercent >= 75) {
      const tier3Height = 2;
      const tier3Geometry = new THREE.CylinderGeometry(baseRadius * 0.75, baseRadius * 0.85, tier3Height, 32, 1, true);
      const tier3Edges = new THREE.EdgesGeometry(tier3Geometry);
      const tier3Line = new THREE.LineSegments(tier3Edges, new THREE.LineBasicMaterial({ 
        color: progressPercent === 100 ? 0xFFD700 : buildingColor,
        opacity: Math.min(1, (progressPercent - 75) / 25)
      }));
      tier3Line.position.y = baseHeight + 7 + tier3Height / 2;
      group.add(tier3Line);
    }
    
    return group;
  };

  const createSagradaFamilia = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    const detailColor = new THREE.Color(building.detailColor || buildingColor);
    
    // Base (always visible)
    const baseGeometry = new THREE.BoxGeometry(8, 2, 6);
    const baseEdges = new THREE.EdgesGeometry(baseGeometry);
    const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5 
    }));
    baseLine.position.y = 1;
    group.add(baseLine);
    
    // Main towers (visible at 25%+)
    if (progressPercent >= 25) {
      const towerPositions = [
        { x: -2, z: 0, height: 15 },
        { x: 0, z: 0, height: 20 },
        { x: 2, z: 0, height: 15 }
      ];
      
      towerPositions.forEach((pos, i) => {
        const towerGeometry = new THREE.ConeGeometry(1, pos.height, 8);
        const towerEdges = new THREE.EdgesGeometry(towerGeometry);
        const towerLine = new THREE.LineSegments(towerEdges, new THREE.LineBasicMaterial({ 
          color: buildingColor,
          opacity: Math.min(1, (progressPercent - 25) / 25)
        }));
        towerLine.position.set(pos.x, 2 + pos.height / 2, pos.z);
        group.add(towerLine);
      });
    }
    
    // Gothic details (visible at 50%+)
    if (progressPercent >= 50) {
      const detailCount = 12;
      for (let i = 0; i < detailCount; i++) {
        const angle = (i / detailCount) * Math.PI * 2;
        const radius = 4;
        const detail = new THREE.ConeGeometry(0.3, 2, 4);
        const detailEdges = new THREE.EdgesGeometry(detail);
        const detailLine = new THREE.LineSegments(detailEdges, new THREE.LineBasicMaterial({ 
          color: accentColor,
          opacity: Math.min(1, (progressPercent - 50) / 25)
        }));
        detailLine.position.x = Math.cos(angle) * radius;
        detailLine.position.z = Math.sin(angle) * radius;
        detailLine.position.y = 8;
        group.add(detailLine);
      }
    }
    
    // Ornate top (visible at 75%+)
    if (progressPercent >= 75) {
      const crossGeometry = new THREE.BoxGeometry(0.2, 4, 0.2);
      const crossVertical = new THREE.Mesh(crossGeometry, new THREE.MeshBasicMaterial({ 
        color: progressPercent === 100 ? 0xFFD700 : detailColor
      }));
      crossVertical.position.y = 24;
      
      const crossHorizontal = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: progressPercent === 100 ? 0xFFD700 : detailColor })
      );
      crossHorizontal.position.y = 25;
      
      const crossGroup = new THREE.Group();
      crossGroup.add(crossVertical);
      crossGroup.add(crossHorizontal);
      
      const crossEdges = new THREE.EdgesGeometry(crossGeometry);
      const crossLine = new THREE.LineSegments(crossEdges, new THREE.LineBasicMaterial({ 
        color: progressPercent === 100 ? 0xFFD700 : detailColor,
        opacity: Math.min(1, (progressPercent - 75) / 25)
      }));
      crossLine.position.y = 24;
      group.add(crossLine);
    }
    
    return group;
  };

  const createWindmill = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    
    // Base (always visible)
    const baseGeometry = new THREE.CylinderGeometry(3, 4, 2, 8);
    const baseEdges = new THREE.EdgesGeometry(baseGeometry);
    const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5 
    }));
    baseLine.position.y = 1;
    group.add(baseLine);
    
    // Main body (visible at 25%+)
    if (progressPercent >= 25) {
      const bodyGeometry = new THREE.CylinderGeometry(2.5, 3, 8, 8);
      const bodyEdges = new THREE.EdgesGeometry(bodyGeometry);
      const bodyLine = new THREE.LineSegments(bodyEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 25) / 25)
      }));
      bodyLine.position.y = 6;
      group.add(bodyLine);
    }
    
    // Roof (visible at 50%+)
    if (progressPercent >= 50) {
      const roofGeometry = new THREE.ConeGeometry(3, 4, 8);
      const roofEdges = new THREE.EdgesGeometry(roofGeometry);
      const roofLine = new THREE.LineSegments(roofEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 50) / 25)
      }));
      roofLine.position.y = 12;
      group.add(roofLine);
    }
    
    // Blades (visible at 75%+)
    if (progressPercent >= 75) {
      const bladeLength = 5;
      const bladeGroup = new THREE.Group();
      bladeGroup.name = 'blades'; // Name for animation reference
      
      for (let i = 0; i < 4; i++) {
        const bladeGeometry = new THREE.BoxGeometry(0.5, bladeLength, 0.1);
        const bladeEdges = new THREE.EdgesGeometry(bladeGeometry);
        const bladeLine = new THREE.LineSegments(bladeEdges, new THREE.LineBasicMaterial({ 
          color: progressPercent === 100 ? 0xFFD700 : accentColor,
          opacity: Math.min(1, (progressPercent - 75) / 25)
        }));
        bladeLine.position.y = bladeLength / 2;
        bladeLine.rotation.z = (i * Math.PI) / 2;
        bladeGroup.add(bladeLine);
      }
      
      bladeGroup.position.y = 8;
      bladeGroup.position.z = 2.6;
      
      group.add(bladeGroup);
    }
    
    return group;
  };

  const createBrandenburgGate = (building: BuildingData, progressPercent: number): THREE.Group => {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(building.buildingColor);
    const accentColor = new THREE.Color(building.accentColor);
    
    // Base platform (always visible)
    const baseGeometry = new THREE.BoxGeometry(12, 0.5, 6);
    const baseEdges = new THREE.EdgesGeometry(baseGeometry);
    const baseLine = new THREE.LineSegments(baseEdges, new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.5 
    }));
    baseLine.position.y = 0.25;
    group.add(baseLine);
    
    // Columns (visible at 25%+)
    if (progressPercent >= 25) {
      const columnPositions = [
        { x: -4.5, z: 0 },
        { x: -1.5, z: 0 },
        { x: 1.5, z: 0 },
        { x: 4.5, z: 0 }
      ];
      
      columnPositions.forEach(pos => {
        const columnGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
        const columnEdges = new THREE.EdgesGeometry(columnGeometry);
        const columnLine = new THREE.LineSegments(columnEdges, new THREE.LineBasicMaterial({ 
          color: buildingColor,
          opacity: Math.min(1, (progressPercent - 25) / 25)
        }));
        columnLine.position.set(pos.x, 4.5, pos.z);
        group.add(columnLine);
      });
    }
    
    // Top structure (visible at 50%+)
    if (progressPercent >= 50) {
      const topGeometry = new THREE.BoxGeometry(12, 2, 6);
      const topEdges = new THREE.EdgesGeometry(topGeometry);
      const topLine = new THREE.LineSegments(topEdges, new THREE.LineBasicMaterial({ 
        color: buildingColor,
        opacity: Math.min(1, (progressPercent - 50) / 25)
      }));
      topLine.position.y = 9;
      group.add(topLine);
    }
    
    // Quadriga (chariot) on top (visible at 75%+)
    if (progressPercent >= 75) {
      const quadrigaGroup = new THREE.Group();
      
      // Chariot base
      const chariotGeometry = new THREE.BoxGeometry(3, 1, 2);
      const chariotEdges = new THREE.EdgesGeometry(chariotGeometry);
      const chariotLine = new THREE.LineSegments(chariotEdges, new THREE.LineBasicMaterial({ 
        color: progressPercent === 100 ? 0xFFD700 : accentColor,
        opacity: Math.min(1, (progressPercent - 75) / 25)
      }));
      quadrigaGroup.add(chariotLine);
      
      // Horses (simplified)
      for (let i = 0; i < 4; i++) {
        const horseGeometry = new THREE.ConeGeometry(0.3, 1.5, 4);
        const horseEdges = new THREE.EdgesGeometry(horseGeometry);
        const horseLine = new THREE.LineSegments(horseEdges, new THREE.LineBasicMaterial({ 
          color: progressPercent === 100 ? 0xFFD700 : accentColor,
          opacity: Math.min(1, (progressPercent - 75) / 25)
        }));
        horseLine.position.x = -1.5 + i;
        horseLine.position.y = 0.75;
        quadrigaGroup.add(horseLine);
      }
      
      quadrigaGroup.position.y = 11;
      group.add(quadrigaGroup);
    }
    
    return group;
  };

  const createBuilding = (building: BuildingData, progressPercent: number): THREE.Group => {
    let buildingGroup: THREE.Group;
    
    switch (building.id) {
      case 'bigben':
        buildingGroup = createBigBen(building, progressPercent);
        break;
      case 'eiffel':
        buildingGroup = createEiffelTower(building, progressPercent);
        break;
      case 'colosseum':
        buildingGroup = createColosseum(building, progressPercent);
        break;
      case 'sagrada':
        buildingGroup = createSagradaFamilia(building, progressPercent);
        break;
      case 'windmill':
        buildingGroup = createWindmill(building, progressPercent);
        break;
      case 'brandenburg':
        buildingGroup = createBrandenburgGate(building, progressPercent);
        break;
      default:
        // Fallback
        buildingGroup = new THREE.Group();
        const geometry = new THREE.BoxGeometry(5, 10, 5);
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
          color: building.buildingColor,
          opacity: progressPercent / 100
        }));
        buildingGroup.add(line);
    }
    
    buildingGroup.position.set(building.position.x, building.position.y, building.position.z);
    buildingGroup.scale.setScalar(building.scale);
    buildingGroup.userData = { building, progressPercent };
    
    return buildingGroup;
  };

  const init = useCallback(() => {
    if (!mountRef.current || isInitializedRef.current) return;
    
    isInitializedRef.current = true;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Slightly lighter background
    scene.fog = new THREE.Fog(0x1a1a1a, 40, 150); // Adjusted fog for better visibility
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(40, 30, 60);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    // Lights - increased intensity for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    // Add second directional light from opposite side
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, 20, -10);
    scene.add(directionalLight2);
    
    // Add point light for glow effect
    const pointLight = new THREE.PointLight(0xffd700, 0.7, 100);
    pointLight.position.set(0, 20, 0);
    scene.add(pointLight);

    // Ground grid - brighter colors
    const gridHelper = new THREE.GridHelper(100, 40, 0x666666, 0x444444);
    scene.add(gridHelper);

    // Add circular guides
    for (let i = 1; i <= 3; i++) {
      const radius = i * 15;
      const circleGeometry = new THREE.CircleGeometry(radius, 64);
      const circleEdges = new THREE.EdgesGeometry(circleGeometry);
      const circleLine = new THREE.LineSegments(circleEdges, new THREE.LineBasicMaterial({ 
        color: 0x555555, 
        transparent: true, 
        opacity: 0.5 
      }));
      circleLine.rotation.x = -Math.PI / 2;
      circleLine.position.y = 0.01;
      scene.add(circleLine);
    }

    // Add buildings
    buildings.forEach(building => {
      const progressPercent = getProgressPercentage(building.category);
      const buildingMesh = createBuilding(building, progressPercent);
      buildingsRef.current.set(building.id, buildingMesh);
      scene.add(buildingMesh);
    });

  }, [buildings, getProgressPercentage]);

  const animate = useCallback(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current || !controlsRef.current) return;

    controlsRef.current.update();
    
    // Animate buildings
    buildingsRef.current.forEach((building, id) => {
      const buildingData = buildings.find(b => b.id === id);
      if (buildingData) {
        const progressPercent = getProgressPercentage(buildingData.category);
        
        // Rotate hovered building
        if (hoveredBuilding === id) {
          building.rotation.y += 0.01;
        }
        
        // Rotate completed buildings slowly
        if (progressPercent === 100) {
          building.rotation.y += 0.002;
        }
        
        // Animate windmill blades if it's the windmill and has progress
        if (id === 'windmill' && progressPercent >= 75) {
          const blades = building.getObjectByName('blades');
          if (blades) {
            blades.rotation.z += progressPercent === 100 ? 0.02 : 0.01;
          }
        }
      }
    });

    // Animate particles
    particlesRef.current.forEach((particles, id) => {
      const positions = particles.geometry.attributes.position;
      const velocities = particles.geometry.attributes.velocity;
      particles.userData.lifetime += 0.016; // ~60fps
      
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        positions.array[i3] += velocities.array[i3];
        positions.array[i3 + 1] += velocities.array[i3 + 1] - 0.01; // gravity
        positions.array[i3 + 2] += velocities.array[i3 + 2];
      }
      
      positions.needsUpdate = true;
      
      // Fade out particles
      const material = particles.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - particles.userData.lifetime / 3);
      
      // Remove particles after 3 seconds
      if (particles.userData.lifetime > 3) {
        sceneRef.current!.remove(particles);
        particlesRef.current.delete(id);
      }
    });

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [hoveredBuilding, buildings, getProgressPercentage]);

  const handleResize = useCallback(() => {
    if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

    cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    
    let foundBuilding = null;
    for (const intersect of intersects) {
      let obj = intersect.object;
      while (obj.parent && !obj.userData.building) {
        obj = obj.parent;
      }
      if (obj.userData.building) {
        foundBuilding = obj.userData.building.id;
        break;
      }
    }
    
    setHoveredBuilding(foundBuilding);
    mountRef.current.style.cursor = foundBuilding ? 'pointer' : 'grab';
  }, []);

  const handleClick = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    
    for (const intersect of intersects) {
      let obj = intersect.object;
      while (obj.parent && !obj.userData.building) {
        obj = obj.parent;
      }
      if (obj.userData.building) {
        const building = obj.userData.building as BuildingData;
        router.push(`/study?mode=category&selected=${encodeURIComponent(building.category)}`);
        break;
      }
    }
  }, [router]);

  useEffect(() => {
    init();
    animate();

    const currentMount = mountRef.current;
    if (currentMount) {
      currentMount.addEventListener('mousemove', handleMouseMove);
      currentMount.addEventListener('click', handleClick);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (currentMount) {
        currentMount.removeEventListener('mousemove', handleMouseMove);
        currentMount.removeEventListener('click', handleClick);
        window.removeEventListener('resize', handleResize);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Proper cleanup to prevent WebGL context leaks
      if (rendererRef.current) {
        if (mountRef.current && rendererRef.current.domElement.parentElement === mountRef.current) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      // Clean up scene resources
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
          if (object instanceof THREE.Points) {
            object.geometry?.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      
      // Clean up controls
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      // Reset initialization flag
      isInitializedRef.current = false;
    };
  }, []); // Empty dependency array to run only once

  // Update buildings when progress changes
  useEffect(() => {
    if (!sceneRef.current) return;

    buildingsRef.current.forEach((buildingMesh, id) => {
      const building = buildings.find(b => b.id === id);
      if (building) {
        const oldProgressPercent = buildingMesh.userData.progressPercent || 0;
        const progressPercent = getProgressPercentage(building.category);
        
        // Remove old building
        sceneRef.current!.remove(buildingMesh);
        
        // Create new building with updated progress
        const newBuildingMesh = createBuilding(building, progressPercent);
        newBuildingMesh.userData.progressPercent = progressPercent;
        buildingsRef.current.set(id, newBuildingMesh);
        sceneRef.current!.add(newBuildingMesh);
        
        // Add celebration particles if just reached 100%
        if (oldProgressPercent < 100 && progressPercent === 100) {
          const particles = createCelebrationParticles(new THREE.Vector3(
            building.position.x,
            building.position.y + 10,
            building.position.z
          ));
          particlesRef.current.set(`${id}-celebration`, particles);
          sceneRef.current!.add(particles);
        }
      }
    });
  }, [progress, buildings, getProgressPercentage, createBuilding, createCelebrationParticles]);

  const hoveredBuildingData = hoveredBuilding ? buildings.find(b => b.id === hoveredBuilding) : null;
  const hoveredProgress = hoveredBuildingData ? getProgressPercentage(hoveredBuildingData.category) : 0;
  const hoveredCategoryProgress = hoveredBuildingData ? progress[hoveredBuildingData.category] : null;

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg p-6 relative">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
        <span className="text-2xl">🏗️</span>
        学習の旅 - 3D Wire Art Progress
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        問題を解いて、欧州の名建築を3Dワイヤーアートで完成させよう
      </p>
      
      <div className="relative">
        <div ref={mountRef} className="w-full h-[400px] rounded-lg overflow-hidden" />
        
        {/* Hover tooltip */}
        {hoveredBuildingData && (
          <div className="absolute top-4 left-4 bg-gray-800 text-white rounded-lg p-4 shadow-2xl max-w-xs backdrop-blur-sm bg-opacity-95 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{hoveredBuildingData.icon}</span>
              <div>
                <h3 className="font-bold">{hoveredBuildingData.name}</h3>
                <p className="text-sm text-gray-400">{hoveredBuildingData.nameJa}</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 mb-3">{hoveredBuildingData.description}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進捗:</span>
                <span className={`font-bold ${hoveredProgress === 100 ? 'text-yellow-400' : ''}`}>
                  {hoveredProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hoveredProgress === 100 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 animate-shimmer' : 'bg-blue-500'
                  }`}
                  style={{ width: `${hoveredProgress}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">
                {hoveredCategoryProgress?.answeredQuestions || 0} / {hoveredCategoryProgress?.totalQuestions || 0} 問完了
              </div>
              {hoveredProgress === 100 && (
                <div className="text-xs text-yellow-400 font-medium">
                  ✨ 完成！素晴らしい！
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
              クリックして学習を開始 →
            </div>
          </div>
        )}
      </div>
      
      {/* Progress overview */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {buildings.map(building => {
          const progressPercent = getProgressPercentage(building.category);
          return (
            <div 
              key={building.id}
              className="text-center p-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => router.push(`/study?mode=category&selected=${encodeURIComponent(building.category)}`)}
            >
              <div className="text-lg mb-1">{building.icon}</div>
              <div className="text-xs text-gray-400">{building.name}</div>
              <div className="text-sm font-bold text-white">{progressPercent}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}