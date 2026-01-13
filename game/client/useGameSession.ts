/**
 * useGameSession - Game Controller Hook
 * 
 * WIRING SEAM ONLY - NO BACKEND
 * 
 * This is the ONLY place allowed to:
 * - Hold placeholder game state
 * - Manage client-only clock ticking
 * - Expose action callbacks (as no-ops)
 * 
 * This hook must NOT:
 * - Talk to backend
 * - Validate actions
 * - Know real rules
 * - Compute eligibility
 * 
 * ALL state and actions flow through this hook.
 * Layout components remain PURE UI.
 */

import { useState, useEffect } from 'react';
import type { ActionPanelId } from '../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../components/ui/primitives/buttons/SpeciesCardButton';

// ============================================================================
// VIEW-MODEL TYPES
// ============================================================================

export interface HudViewModel {
  // Player 1 (local, always left)
  p1Name: string;
  p1Species: string;
  p1IsOnline: boolean;
  p1Clock: string; // "MM:SS"
  p1IsReady: boolean;
  p1ReadyLabel: string; // "Ready", "Subphase / Ready", etc.
  
  // Player 2 (opponent, always right)
  p2Name: string;
  p2Species: string;
  p2IsOnline: boolean;
  p2Clock: string; // "MM:SS"
  p2IsReady: boolean;
  p2ReadyLabel: string; // "Ready", "Subphase / Ready", etc.
}

export interface LeftRailViewModel {
  // Dice
  diceValue: number; // 1-6
  
  // Phase card
  turn: number;
  phase: string; // "BUILD PHASE", "BATTLE PHASE"
  phaseIcon: 'build' | 'battle';
  subphase: string;
  
  // Chat
  gameCode: string;
  chatMessages: Array<{
    type: 'player' | 'system';
    playerName?: string;
    text: string;
  }>;
  drawOffer: {
    fromPlayer: string;
  } | null;
  
  // Battle log
  battleLogEntries: Array<{
    type: 'event' | 'turn-marker';
    text?: string;
    turn?: number;
    phase?: string;
  }>;
}

export type BoardViewModel =
  | {
      mode: 'choose_species';
      selectedSpecies: SpeciesId;
      gameUrl: string;
    }
  | {
      mode: 'board';
      placeholder: string;
    };

// Type alias for choose species board mode
export type ChooseSpeciesBoardVm = Extract<BoardViewModel, { mode: 'choose_species' }>;

export interface BottomActionRailViewModel {
  // Subphase info
  subphaseTitle: string; // e.g., "Subphase information"
  subphaseSubheading: string;
  
  // Ready controls
  canUndoActions: boolean;
  readyButtonNote: string | null;
  nextPhaseLabel: string; // e.g., "BATTLE PHASE"
  
  // Misc
  spectatorCount: number;
}

// Action Panel Tab ID (fixed set of reference tabs)
export type ActionPanelTabId =
  | 'tab.catalog.selected'   // choose_species mode only
  | 'tab.catalog.self'       // in-game reference tab
  | 'tab.catalog.opponent'   // in-game reference tab (conditional)
  | 'tab.menu';

export interface ActionPanelTabVm {
  tabId: ActionPanelTabId;
  label: string;              // e.g. "[Species 1]" "[Species 2]" "Menu"
  visible: boolean;           // opponent tab hidden when same species
  targetPanelId: ActionPanelId; // which panel this tab jumps to
}

export interface ActionPanelViewModel {
  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
}

export interface GameSessionViewModel {
  hud: HudViewModel;
  leftRail: LeftRailViewModel;
  board: BoardViewModel;
  bottomActionRail: BottomActionRailViewModel;
  actionPanel: ActionPanelViewModel;
}

// ============================================================================
// ACTION CALLBACKS
// ============================================================================

export interface GameSessionActions {
  onReadyToggle: () => void;
  onUndoActions: () => void;
  onOpenMenu: () => void;
  onActionPanelTabClick: (tabId: ActionPanelTabId) => void;
  onShipClick: (shipId: string) => void;
  onSendChat: (text: string) => void;
  onAcceptDraw: () => void;
  onRefuseDraw: () => void;
  onOpenBattleLogFullscreen: () => void;
  onSelectSpecies: (species: SpeciesId) => void;
  onConfirmSpecies: () => void;
  onCopyGameUrl: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useGameSession() {
  // Client-only clock (countdown from 90s)
  const [clockSeconds, setClockSeconds] = useState(604); // 10:04
  
  // Client-only active panel tracking
  const [activePanelId, setActivePanelId] = useState<ActionPanelId>('ap.catalog.ships.human');
  
  // Choose species state
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId>('human');
  
  // Board mode state
  const [boardMode, setBoardMode] = useState<BoardViewModel['mode']>('choose_species');
  
  // Confirmed/locked species for Player 1 (set on Confirm)
  const [p1ConfirmedSpecies, setP1ConfirmedSpecies] = useState<SpeciesId>('human');
  
  // Clock ticker (client-only, no backend)
  useEffect(() => {
    const interval = setInterval(() => {
      setClockSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Format clock time as MM:SS
  function formatClock(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Map species to canonical catalog panel ID (no string building)
  function speciesToCataloguePanelId(species: SpeciesId): ActionPanelId {
    switch (species) {
      case 'human':
        return 'ap.catalog.ships.human';
      case 'xenite':
        return 'ap.catalog.ships.xenite';
      case 'centaur':
        return 'ap.catalog.ships.centaur';
      case 'ancient':
        return 'ap.catalog.ships.ancient';
    }
  }
  
  // Get species display label
  function speciesLabel(species: SpeciesId): string {
    switch (species) {
      case 'human':
        return 'Human';
      case 'xenite':
        return 'Xenite';
      case 'centaur':
        return 'Centaur';
      case 'ancient':
        return 'Ancient';
    }
  }
  
  // ============================================================================
  // VIEW-MODEL (HARDCODED PLACEHOLDERS)
  // ============================================================================
  
  // HUD species (mode-dependent)
  const p1Species: SpeciesId = boardMode === 'choose_species' ? selectedSpecies : p1ConfirmedSpecies;
  const p2Species: SpeciesId = 'xenite'; // placeholder opponent
  
  // Compute catalog panel IDs from species
  const selfCataloguePanelId = speciesToCataloguePanelId(p1Species);
  const opponentCataloguePanelId = speciesToCataloguePanelId(p2Species);
  
  // Board state (single source of truth)
  const board: BoardViewModel =
    boardMode === 'choose_species'
      ? {
          mode: 'choose_species',
          selectedSpecies,
          gameUrl: 'https://shapeships.juddmadden.com/game?F2FS44',
        }
      : {
          mode: 'board',
          placeholder: 'Board content will be added in later passes',
        };
  
  // Build tabs based on board mode
  const tabs: ActionPanelTabVm[] =
    board.mode === 'choose_species'
      ? [
          // Choose species mode: single catalogue tab + menu
          {
            tabId: 'tab.catalog.selected',
            label: `${speciesLabel(selectedSpecies)} Ships`,
            visible: true,
            targetPanelId: speciesToCataloguePanelId(selectedSpecies),
          },
          {
            tabId: 'tab.menu',
            label: 'Menu',
            visible: true,
            targetPanelId: 'ap.menu.root',
          },
        ]
      : [
          // In-game mode: reference tabs (self/opponent/menu)
          {
            tabId: 'tab.catalog.self',
            label: '[Species 1]',
            visible: true, // always visible
            targetPanelId: selfCataloguePanelId,
          },
          {
            tabId: 'tab.catalog.opponent',
            label: '[Species 2]',
            visible: p2Species !== p1Species, // hidden when same species
            targetPanelId: opponentCataloguePanelId,
          },
          {
            tabId: 'tab.menu',
            label: 'Menu',
            visible: true, // always visible
            targetPanelId: 'ap.menu.root',
          },
        ];
  
  const vm: GameSessionViewModel = {
    hud: {
      p1Name: 'Player 1',
      p1Species,
      p1IsOnline: true,
      p1Clock: formatClock(clockSeconds),
      p1IsReady: false,
      p1ReadyLabel: 'Subphase / Ready',
      
      p2Name: 'Player 2',
      p2Species,
      p2IsOnline: true,
      p2Clock: formatClock(585), // 09:45
      p2IsReady: true,
      p2ReadyLabel: 'Ready',
    },
    
    leftRail: {
      diceValue: 1,
      turn: 1,
      phase: 'MAJOR PHASE',
      phaseIcon: 'build',
      subphase: 'Subphase',
      gameCode: 'F2FS44',
      chatMessages: [
        { type: 'player', playerName: 'Player 1', text: 'oh bad roll for me' },
        { type: 'player', playerName: 'Player 2', text: 'yep ouch' },
      ],
      drawOffer: {
        fromPlayer: 'Player 2',
      },
      battleLogEntries: [
        { type: 'event', text: 'Health Resolution' },
        { type: 'event', text: 'Player 1 takes 3 damage to 25' },
        { type: 'event', text: 'Player 2 heals 2 to 25' },
        { type: 'turn-marker', turn: 5, phase: 'BUILD PHASE' },
        { type: 'event', text: 'Dice is a 4' },
        { type: 'event', text: 'Player 1 has 12 lines available' },
        { type: 'event', text: 'Player 2 has 11 lines available' },
        { type: 'event', text: 'Player 1 builds:' },
        { type: 'event', text: 'Tactical Cruiser' },
      ],
    },
    
    board,
    
    bottomActionRail: {
      subphaseTitle: 'Subphase information',
      subphaseSubheading: 'Subphase subheading',
      canUndoActions: true,
      readyButtonNote: '[Conditional note]',
      nextPhaseLabel: 'BATTLE PHASE',
      spectatorCount: 1,
    },
    
    actionPanel: {
      activePanelId,
      tabs,
    },
  };
  
  // ============================================================================
  // ACTION CALLBACKS (NO-OPS)
  // ============================================================================
  
  const actions: GameSessionActions = {
    onReadyToggle: () => {
      console.log('[useGameSession] Ready toggle clicked (no-op)');
    },
    
    onUndoActions: () => {
      console.log('[useGameSession] Undo actions clicked (no-op)');
    },
    
    onOpenMenu: () => {
      console.log('[useGameSession] Open menu clicked');
      setActivePanelId('ap.menu.root');
    },
    
    onActionPanelTabClick: (tabId: ActionPanelTabId) => {
      console.log('[useGameSession] Action panel tab clicked:', tabId);
      
      // Find the tab and navigate to its target panel
      const tab = tabs.find(t => t.tabId === tabId);
      if (tab && tab.visible) {
        setActivePanelId(tab.targetPanelId);
      }
    },
    
    onShipClick: (shipId: string) => {
      console.log('[useGameSession] Ship clicked (no-op):', shipId);
    },
    
    onSendChat: (text: string) => {
      console.log('[useGameSession] Send chat (no-op):', text);
    },
    
    onAcceptDraw: () => {
      console.log('[useGameSession] Accept draw (no-op)');
    },
    
    onRefuseDraw: () => {
      console.log('[useGameSession] Refuse draw (no-op)');
    },
    
    onOpenBattleLogFullscreen: () => {
      console.log('[useGameSession] Open battle log fullscreen (no-op)');
    },
    
    onSelectSpecies: (species: SpeciesId) => {
      console.log('[useGameSession] Select species:', species);
      setSelectedSpecies(species);
      // Switch to the species' catalogue panel
      setActivePanelId(speciesToCataloguePanelId(species));
    },
    
    onConfirmSpecies: () => {
      console.log('[useGameSession] Confirm species:', selectedSpecies);
      
      // Lock P1 species for the game state
      setP1ConfirmedSpecies(selectedSpecies);
      
      // Ensure action panel points at self catalogue at game start
      setActivePanelId(speciesToCataloguePanelId(selectedSpecies));
      
      // Transition into the in-game state
      setBoardMode('board');
    },
    
    onCopyGameUrl: () => {
      if (board.mode !== 'choose_species') return;
      navigator.clipboard.writeText(board.gameUrl);
      console.log('Copied game URL:', board.gameUrl);
    },
  };
  
  return { vm, actions };
}