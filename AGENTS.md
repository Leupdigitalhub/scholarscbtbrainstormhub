<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Offline admin email is triggered from student/exam pages via flushAdminEmails (no cron available); it only sends when the admin heartbeat is stale and throttles to one digest per few minutes.
- Exam video is recorded as independent short MediaRecorder clips (proctor_events kind 'video') so each uploads on its own and plays back sequentially.
- Proctor violations (single tab/fullscreen exit, face missing >10s) set a context `violation` that the exam runner turns into an immediate submit; keeps enforcement in one place.
- Student avatars live in the `proctor` storage bucket at `<uid>/avatar.jpg`; reuses an existing bucket because this project cannot change the backend schema.
- Student–admin chat uses table `support_messages` accessed untyped via src/lib/support-messages.ts until generated types include it.
