-- Function to get table structure
CREATE OR REPLACE FUNCTION test_schema()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'column_name', column_name,
        'data_type', data_type,
        'is_nullable', is_nullable
      )
    )
    FROM information_schema.columns
    WHERE table_name = 'events'
    AND table_schema = 'public'
  );
END;
$$;