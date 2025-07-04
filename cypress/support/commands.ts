/// <reference types="cypress" />

// Custom commands for authentication and common actions

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to log in with Firebase Auth
       * @example cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;
      
      /**
       * Custom command to log out
       * @example cy.logout()
       */
      logout(): Chainable<void>;
      
      /**
       * Custom command to wait for Firebase Auth to be ready
       * @example cy.waitForAuth()
       */
      waitForAuth(): Chainable<void>;
      
      /**
       * Custom command to create a highlight in materials page
       * @example cy.createHighlight('Some text to highlight', 'yellow')
       */
      createHighlight(text: string, color?: string): Chainable<void>;
      
      /**
       * Custom command to navigate to materials page with specific content
       * @example cy.visitMaterial('UKFR_ED32_Checkpoint.pdf')
       */
      visitMaterial(filename: string): Chainable<void>;
    }
  }
}

// Login command implementation
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.visit('/login');
      cy.get('#email').type(email);
      cy.get('#password').type(password);
      cy.get('button[type="submit"]').click();
      
      // Wait for redirect to dashboard
      cy.url().should('include', '/dashboard');
      
      // Wait for dashboard to load
      cy.contains('学習状況', { timeout: 10000 }).should('be.visible');
    },
    {
      validate() {
        // Check if user is still logged in by visiting dashboard
        cy.visit('/dashboard');
        cy.url().should('include', '/dashboard');
      },
      cacheAcrossSpecs: true
    }
  );
});

// Logout command
Cypress.Commands.add('logout', () => {
  // Visit dashboard and click logout button
  cy.visit('/dashboard');
  cy.get('button').contains('ログアウト').click();
  cy.url().should('include', '/');
});

// Wait for auth to be ready
Cypress.Commands.add('waitForAuth', () => {
  // Wait for page to be fully loaded
  cy.document().should('exist');
  cy.wait(1000); // Give Firebase time to restore auth state
});

// Create highlight command
Cypress.Commands.add('createHighlight', (text: string, color = 'yellow') => {
  // Select text and trigger highlight
  cy.contains(text).first().trigger('mousedown');
  cy.contains(text).first().trigger('mousemove', { clientX: 100 });
  cy.contains(text).first().trigger('mouseup');
  
  // Wait for highlight popup and select color
  cy.get('.highlight-popup').should('be.visible');
  cy.get(`.highlight-popup button[data-color="${color}"]`).click();
  
  // Verify highlight was created
  cy.get('.search-highlight').should('exist');
});

// Visit material command
Cypress.Commands.add('visitMaterial', (filename: string) => {
  cy.visit('/materials');
  cy.get('select[aria-label="Select a PDF to view"]').select(filename);
  cy.wait(1000); // Wait for material to load
});

export {};