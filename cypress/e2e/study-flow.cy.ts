describe('Study Flow', () => {
  it('should allow a user to log in and start a study session', () => {
    // Start from the home page
    cy.visit('/');

    cy.contains('始める').click();

    // Log in
    cy.get('input[type=email]').type('test@example.com');
    cy.get('input[type=password]').type('password');
    cy.contains('ログイン').click();

    // Start a new study session
    cy.contains('カテゴリ学習を始める').click();

    // Select the first category
    cy.get('[data-cy=category-list]').children().first().click();

    // Start the session
    cy.contains('学習開始').click();

    // Answer the first question
    cy.get('[data-cy=option-A]').click();
    cy.contains('回答する').click();

    // Check the materials
    cy.contains('教材で詳しく確認').click();

    // Verify that the URL is correct and contains the keywords
    cy.url().should('include', '/materials');
    cy.url().should('include', 'keywords=');
  });
});
