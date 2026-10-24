# User stories — {{PROJECT_NAME}}

Owner: BA · {{DATE}} · Rules: `docs/PLAN.md` §3 · QA traces tests to these IDs (`validate.mjs trace`).

Acceptance criteria are numbered per story: `Scenario: AC1 …` has the full ID `US-E1-01/AC1`. Tests name the full AC ID; milestone evidence counts an AC as verified only when an executed test that names it passed.

Priority: **M**ust / **S**hould / **C**ould / **W**on't (MoSCoW) · Size: S / M / L

## E1 <Area>

### US-E1-01 <Short title> · M · S
As a <user> I want <capability> so that <benefit>.

```gherkin
Scenario: AC1 <happy path>
  Given <state>
  When <action>
  Then <observable result>

Scenario: AC2 <boundary or error>
  Given <state>
  When <action>
  Then <observable result>
```

## E7 Accounts (v1)

### US-E7-01 Sign up · S · M
As a visitor I want to create an account so that my <saved things> are available on any device.

```gherkin
Scenario: AC1 Sign up with a magic link
  Given I am signed out
  When I enter my email and confirm the link sent to it
  Then I am signed in
  And anything I saved while signed out is offered for import

Scenario: AC2 Another user's data is never visible
  Given user A has saved items
  When user B is signed in
  Then none of user A's items are listed, readable or editable
```

### US-E7-02 Sign out · S · S
### US-E7-03 Delete my account · S · M
### US-E7-04 Session expired · S · S

## NF Non-functional

### US-NF-01 Performance · M
### US-NF-02 Accessibility (WCAG 2.1 AA) · M
### US-NF-03 Shareable state (URL reproduces the view) · S
