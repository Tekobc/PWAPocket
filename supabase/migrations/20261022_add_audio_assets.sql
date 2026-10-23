ALTER TABLE post_assets
    DROP CONSTRAINT IF EXISTS post_assets_asset_type_check;

ALTER TABLE post_assets
    ADD CONSTRAINT post_assets_asset_type_check
    CHECK (asset_type IN ('image', 'video', 'cover', 'audio'));

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg']
WHERE id = 'media';
