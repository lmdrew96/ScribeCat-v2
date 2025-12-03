/**
 * TutorialFlowDefinitions
 *
 * Default tutorial definitions for ScribeCat onboarding.
 */

import type { Tutorial } from './types.js';

/**
 * Default tutorials built into ScribeCat
 */
export const DEFAULT_TUTORIALS: Tutorial[] = [
  {
    id: 'recording-basics',
    name: 'Recording Basics',
    description: 'Learn how to record and transcribe your first session',
    steps: [
      {
        target: '#record-btn',
        title: 'Start Recording',
        content: 'Click this button or press <kbd>Shift+Space</kbd> to start recording. Your audio will be transcribed in real-time!',
        position: 'bottom',
        beforeShow: async () => {
          // Ensure we're in recording view, not study mode
          const studyModeBtn = document.getElementById('study-mode-btn');
          const studyModeActive = document.querySelector('.view-container.active');

          // If in study mode, exit it first
          if (studyModeActive && studyModeBtn) {
            console.log('Exiting study mode to show recording tutorial');
            studyModeBtn.click();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      },
      {
        target: '#microphone-select',
        title: 'Choose Your Microphone',
        content: 'Select your preferred microphone from the dropdown. The system microphone is selected by default.',
        position: 'bottom'
      },
      {
        target: '#transcription-container',
        title: 'Real-Time Transcription',
        content: 'Watch your words appear here as you speak! Powered by AssemblyAI, the transcription streams in real-time with high accuracy.',
        position: 'right'
      },
      {
        target: '#tiptap-editor',
        title: 'Take Notes',
        content: 'While recording, you can take additional notes here. Format text, add images, create lists - it\'s all saved automatically.',
        position: 'left'
      },
      {
        target: '#record-btn',
        title: 'Stop Recording',
        content: 'Click the button again or press <kbd>Shift+Space</kbd> to stop. Your session is automatically saved - no manual save needed!',
        position: 'bottom'
      }
    ]
  },
  {
    id: 'ai-tools-intro',
    name: 'Nugget Tools Introduction',
    description: 'Discover how Nugget can supercharge your studying',
    steps: [
      {
        target: '#floating-chat-btn',
        title: 'Meet Nugget',
        content: 'Click here to open Nugget chat. Ask questions about your content, get explanations, or request summaries.',
        position: 'left',
        beforeShow: async () => {
          // Ensure we have a session selected
          const chatBtn = document.querySelector('#floating-chat-btn');
          if (chatBtn) {
            (chatBtn as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      },
      {
        target: '#ai-chat-drawer',
        title: 'Chat with Your Content',
        content: 'Nugget can access your session content (you can choose what to include). Try asking "What are the main topics?" or "Explain this concept".',
        position: 'left',
        beforeShow: async () => {
          // Open AI chat drawer
          const chatBtn = document.querySelector('#floating-chat-btn') as HTMLElement;
          if (chatBtn) chatBtn.click();
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for drawer to open
        }
      },
      {
        target: '.session-detail-right .ai-study-tools',
        title: 'Nugget Tool Library',
        content: 'Here are all the Nugget study tools! Generate flashcards, create quizzes, get summaries, and more. All tools are context-aware and work with your session content.',
        position: 'left',
        beforeShow: async () => {
          // Close AI chat drawer if it's open
          const chatDrawer = document.getElementById('ai-chat-drawer');
          if (chatDrawer && !chatDrawer.classList.contains('hidden')) {
            const chatBtn = document.querySelector('#floating-chat-btn') as HTMLElement;
            if (chatBtn) chatBtn.click();
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // Navigate to Study Mode if not already there
          const studyModeBtn = document.getElementById('study-mode-btn');
          const studyModeActive = studyModeBtn?.classList.contains('active');

          if (studyModeBtn && !studyModeActive) {
            console.log('Opening Study Mode for AI tools tutorial');
            studyModeBtn.click();
            await new Promise(resolve => setTimeout(resolve, 800)); // Initial wait for Study Mode to start loading
          }

          // Poll for sessions to appear (sessions load asynchronously)
          const waitForSessions = async (maxAttempts = 10): Promise<NodeListOf<Element> | null> => {
            for (let i = 0; i < maxAttempts; i++) {
              // Check for sessions in all view modes: grid (.session-card), list (.list-row), timeline, board
              const sessionCards = document.querySelectorAll('.session-card, .list-row, .session-list-item');
              if (sessionCards.length > 0) {
                console.log(`Found ${sessionCards.length} sessions after ${i + 1} attempts`);
                return sessionCards;
              }
              console.log(`Waiting for sessions to load... attempt ${i + 1}/${maxAttempts}`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            return null;
          };

          // Open first session if not already viewing one
          const sessionDetailView = document.querySelector('.session-detail-view');
          if (!sessionDetailView) {
            const sessionCards = await waitForSessions();
            if (sessionCards && sessionCards.length > 0) {
              console.log('Opening first session for AI tools tutorial');
              (sessionCards[0] as HTMLElement).click();
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for session detail to render
            } else {
              console.warn('No sessions available for AI tools tutorial - user needs to create a session first');
            }
          } else {
            console.log('Session detail already open');
            // Session detail already open, wait for AI tools to render
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      }
    ]
  },
  {
    id: 'study-mode',
    name: 'Study Mode Tour',
    description: 'Learn how to use Study Mode for review and practice',
    steps: [
      {
        target: '#study-mode-btn',
        title: 'Enter Study Mode',
        content: 'Study Mode shows all your sessions with AI-generated study materials. Click here to enter.',
        position: 'bottom',
        action: {
          text: 'Open Study Mode',
          onClick: async () => {
            const btn = document.querySelector('#study-mode-btn') as HTMLElement;
            if (btn) btn.click();
          }
        }
      },
      {
        target: '#session-list',
        title: 'Your Sessions',
        content: 'All your recorded sessions appear here. Click any session to review transcription, notes, and AI tools.',
        position: 'right'
      },
      {
        target: '.search-bar-container',
        title: 'Smart Search',
        content: 'Search across all sessions, transcriptions, notes, and AI-generated content. Try "photosynthesis" or "exam prep".',
        position: 'bottom'
      }
    ]
  },
  {
    id: 'keyboard-shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Master keyboard shortcuts for faster workflow',
    steps: [
      {
        target: 'body',
        title: 'Command Palette',
        content: 'Press <kbd>Cmd+K</kbd> anywhere to open the command palette. Search for any action - no need to remember where buttons are!',
        position: 'center',
        action: {
          text: 'Try It (Cmd+K)',
          onClick: async () => {
            // Trigger command palette
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }
        }
      },
      {
        target: 'body',
        title: 'Shortcuts Overlay',
        content: 'Press <kbd>?</kbd> to see all keyboard shortcuts. This overlay shows context-specific shortcuts based on where you are in the app.',
        position: 'center',
        action: {
          text: 'Show Shortcuts (?)',
          onClick: async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
          }
        }
      },
      {
        target: '#tiptap-editor',
        title: 'Text Formatting',
        content: 'Use standard shortcuts: <kbd>Cmd+B</kbd> for bold, <kbd>Cmd+I</kbd> for italic, <kbd>Cmd+U</kbd> for underline. More shortcuts available in the ? overlay!',
        position: 'top'
      }
    ]
  }
];
