describe('Materials Page E2E Tests', () => {
  beforeEach(() => {
    // Log in before each test
    cy.login('test@example.com', 'test123');
    cy.waitForAuth();
  });

  describe('Material Viewing', () => {
    it('should load PDF material successfully', () => {
      cy.visitMaterial('UKFR_ED32_Checkpoint.pdf');
      
      // Check that PDF viewer is visible
      cy.get('.react-pdf__Document').should('be.visible');
      
      // Check page navigation
      cy.get('input[type="number"]').should('have.value', '1');
      cy.get('button[aria-label="Next page"]').click();
      cy.get('input[type="number"]').should('have.value', '2');
    });

    it('should switch between view modes', () => {
      cy.visit('/materials');
      
      // Switch to HTML view
      cy.get('select[aria-label="Select view mode"]').select('html');
      cy.get('.html-content-container').should('be.visible');
      
      // Switch to text view
      cy.get('select[aria-label="Select view mode"]').select('text');
      cy.get('pre').should('be.visible');
      
      // Switch back to PDF view
      cy.get('select[aria-label="Select view mode"]').select('pdf');
      cy.get('.react-pdf__Document').should('be.visible');
    });

    it('should toggle table of contents', () => {
      cy.visit('/materials');
      
      // Open TOC
      cy.get('button').contains('Book').parent().click();
      cy.get('.w-64.bg-gray-800').should('be.visible');
      
      // TOC should contain items
      cy.get('.w-64.bg-gray-800').within(() => {
        cy.get('button').should('have.length.greaterThan', 0);
      });
      
      // Close TOC
      cy.get('button').contains('Book').parent().click();
      cy.get('.w-64.bg-gray-800').should('not.exist');
    });
  });

  describe('Search Functionality', () => {
    it('should search within HTML content', () => {
      cy.visit('/materials');
      cy.get('select[aria-label="Select view mode"]').select('html');
      
      // Wait for content to load
      cy.wait(1000);
      
      // Perform search
      cy.get('input[placeholder="Search..."]').type('example');
      
      // Check search results indicator
      cy.get('.fixed.top-16.right-4').should('be.visible');
      cy.get('.fixed.top-16.right-4').should('contain', '件');
      
      // Navigate through search results
      cy.get('button[title="次の検索結果"]').click();
      cy.get('button[title="前の検索結果"]').click();
    });
  });

  describe('Highlight Functionality', () => {
    it('should create and save a highlight', () => {
      cy.visit('/materials');
      cy.get('select[aria-label="Select view mode"]').select('html');
      
      // Wait for content to load
      cy.wait(1500);
      
      // Select text and create highlight
      cy.get('.html-content-container').within(() => {
        cy.get('p').first().then(($p) => {
          const text = $p.text().substring(0, 20);
          
          // Create selection
          cy.wrap($p).trigger('mousedown', { which: 1 });
          cy.wrap($p).trigger('mousemove', { which: 1, clientX: 100 });
          cy.wrap($p).trigger('mouseup');
        });
      });
      
      // Select highlight color
      cy.get('[class*="highlight-popup"]').should('be.visible');
      cy.get('[class*="highlight-popup"]').within(() => {
        cy.get('button').first().click(); // Select first color
      });
      
      // Verify highlight was created
      cy.get('.search-highlight').should('exist');
    });

    it('should add a note to a highlight', () => {
      // First create a highlight
      cy.visit('/materials');
      cy.get('select[aria-label="Select view mode"]').select('html');
      cy.wait(1500);
      
      // Create highlight (similar to above)
      cy.get('.html-content-container').within(() => {
        cy.get('p').first().then(($p) => {
          cy.wrap($p).trigger('mousedown', { which: 1 });
          cy.wrap($p).trigger('mousemove', { which: 1, clientX: 100 });
          cy.wrap($p).trigger('mouseup');
        });
      });
      
      cy.get('.highlight-popup').within(() => {
        cy.get('button').first().click();
      });
      
      // Click on the highlight to edit note
      cy.get('.search-highlight').first().click();
      
      // Add note
      cy.get('textarea').type('This is a test note');
      cy.get('button').contains('保存').click();
      
      // Verify note was saved
      cy.get('.search-highlight').first().should('have.attr', 'title').and('contain', 'This is a test note');
    });
  });

  describe('Navigation from Study Page', () => {
    it('should navigate to material with anchor from study page', () => {
      // Simulate navigation from study page with anchor
      cy.window().then((win) => {
        win.localStorage.setItem('materialNavigationState', JSON.stringify({
          anchor: {
            selector: 'p:first-child',
            startOffset: 0,
            endOffset: 50,
            selectedText: 'test',
            beforeText: '',
            afterText: '',
            pageNumber: 1
          },
          from: 'study',
          questionId: 'test-question-1'
        }));
      });
      
      cy.visit('/materials');
      
      // Verify temporary highlight is applied
      cy.get('.html-content-container').within(() => {
        cy.get('[style*="background-color"]').should('exist');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when PDF fails to load', () => {
      // Visit with invalid PDF
      cy.visit('/materials');
      cy.get('select[aria-label="Select a PDF to view"]').select('UKFR_ED32_Checkpoint.pdf');
      
      // Intercept PDF request and force error
      cy.intercept('GET', '**/materials/*.pdf', { statusCode: 404 }).as('pdfError');
      
      // Trigger reload
      cy.reload();
      cy.wait('@pdfError');
      
      // Check error message
      cy.get('.text-red-500').should('be.visible');
      cy.get('button').contains('再読み込み').should('be.visible');
    });
  });
});