# Candidate-flow implementation status

## Implemented in this package
- Candidate-specific page separate from recruiter dashboard
- Candidate name/email intake and consent checkbox
- Scenario selection and conversation simulation
- Candidate progress and finish/submission UX
- Preview mode downloads JSON so a submission can be preserved
- Candidate invite-link generator in recruiter interface, pre-fills candidate details, stores locally, and warns that it is preview-only
- Demo dashboard warning
- Supabase schema and Edge Function submission skeleton
- Setup instructions and explicit limitations

## Not yet production-ready
- Supabase project provisioning/configuration
- Authenticated recruiter/admin login
- Secure server-side invite creation and revocation
- Invite token validation and one-time use requires backend setup
- Candidate scoring is currently computed in browser; it is not tamper-resistant
- Backend submissions do not appear in recruiter dashboard yet
- Candidate data retention/deletion workflow and privacy policy
- Full visual/browser QA and end-to-end deployment test

## Do not send real candidates the current public URL as an official assessment
Until backend setup and end-to-end verification are completed, the candidate page is a preview and will not automatically submit results to the recruiter.
