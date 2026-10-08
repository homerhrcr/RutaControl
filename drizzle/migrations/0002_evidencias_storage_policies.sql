CREATE POLICY "Staff sube evidencias de su empresa" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = public.current_organization_id()::text);
CREATE POLICY "Staff ve evidencias de su empresa" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = public.current_organization_id()::text);
CREATE POLICY "Admin borra evidencias de su empresa" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidencias' AND public.is_admin(auth.uid()) AND (storage.foldername(name))[1] = public.current_organization_id()::text);