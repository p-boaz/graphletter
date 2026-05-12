-- Make scf_control_integrations.scf_control_id cascade on delete.
--
-- The baseline FK was NO ACTION (effectively RESTRICT), which blocks the
-- writer's version-filtered DELETE on scf_controls during re-runs of
-- `pnpm seed`. SCI is graphletter-authored fixture data downstream of the
-- canonical SCF control set; if a control disappears in a version migration,
-- its integration mappings should disappear with it.

ALTER TABLE public.scf_control_integrations
  DROP CONSTRAINT IF EXISTS scf_control_integrations_scf_control_id_fkey;

ALTER TABLE public.scf_control_integrations
  ADD CONSTRAINT scf_control_integrations_scf_control_id_fkey
    FOREIGN KEY (scf_control_id)
    REFERENCES public.scf_controls(id)
    ON DELETE CASCADE;
