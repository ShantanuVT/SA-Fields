-- ============================================================
-- IndustrialSaaS - Complete Database Schema
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USER PROFILES TABLE
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'engineer', 'customer')) DEFAULT 'customer',
  name TEXT NOT NULL,
  mobile TEXT DEFAULT '',
  address TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. MACHINES TABLE
-- ============================================================
CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number TEXT NOT NULL UNIQUE,
  model_number TEXT NOT NULL,
  name TEXT NOT NULL,
  specs TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purchase_date DATE,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'under_service', 'retired')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_machines_owner ON machines(owner_id);
CREATE INDEX idx_machines_serial ON machines(serial_number);
CREATE INDEX idx_machines_model ON machines(model_number);

-- ============================================================
-- 3. PARTS TABLE
-- ============================================================
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  compatible_models TEXT DEFAULT '',
  stock_status TEXT NOT NULL CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')) DEFAULT 'in_stock',
  assigned_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ISSUES TABLE
-- ============================================================
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('submitted', 'under_review', 'assigned', 'resolved')) DEFAULT 'submitted',
  assigned_engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tentative_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_issues_customer ON issues(customer_id);
CREATE INDEX idx_issues_engineer ON issues(assigned_engineer_id);
CREATE INDEX idx_issues_machine ON issues(machine_id);
CREATE INDEX idx_issues_status ON issues(status);

-- ============================================================
-- 5. ISSUE MEDIA TABLE
-- ============================================================
CREATE TABLE issue_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. SERVICE REPORTS TABLE
-- ============================================================
CREATE TABLE service_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL NOT NULL,
  engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  service_details TEXT NOT NULL DEFAULT '',
  parts_replaced TEXT DEFAULT '',
  next_service_date DATE,
  remarks TEXT DEFAULT '',
  actual_resolution_date DATE,
  pdf_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_machine ON service_reports(machine_id);
CREATE INDEX idx_reports_engineer ON service_reports(engineer_id);

-- ============================================================
-- 7. MACHINE HISTORY TABLE
-- ============================================================
CREATE TABLE machine_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('issue_raised', 'engineer_assigned', 'service_completed', 'part_replaced', 'note')),
  description TEXT NOT NULL,
  reference_id UUID,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_machine_history_machine ON machine_history(machine_id);

-- ============================================================
-- 8. ENGINEER ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE engineer_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL NOT NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL NOT NULL,
  assigned_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'revoked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_engineer ON engineer_assignments(engineer_id);
CREATE INDEX idx_assignments_issue ON engineer_assignments(issue_id);

-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('issue_submitted', 'engineer_assigned', 'service_completed', 'report_generated', 'general')) DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- ============================================================
-- 10. AUTO-UPDATE TIMESTAMPS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_reports_updated_at
  BEFORE UPDATE ON service_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engineer_assignments_updated_at
  BEFORE UPDATE ON engineer_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is admin (super_admin or admin)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- USER PROFILES POLICIES
-- ============================================================
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Super admin can manage all profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update all profiles"
  ON user_profiles FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- MACHINES POLICIES
-- ============================================================
CREATE POLICY "Admins can read all machines"
  ON machines FOR SELECT
  USING (is_admin());

CREATE POLICY "Customers can read own machines"
  ON machines FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Engineers can read assigned machines"
  ON machines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM engineer_assignments
      WHERE engineer_assignments.machine_id = machines.id
      AND engineer_assignments.engineer_id = auth.uid()
      AND engineer_assignments.status = 'approved'
    )
  );

CREATE POLICY "Admins can insert machines"
  ON machines FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update machines"
  ON machines FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- PARTS POLICIES
-- ============================================================
CREATE POLICY "Admins can read all parts"
  ON parts FOR SELECT
  USING (is_admin());

CREATE POLICY "Customers can read parts for their machines"
  ON parts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines
      WHERE machines.id = parts.assigned_machine_id
      AND machines.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage parts"
  ON parts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update parts"
  ON parts FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- ISSUES POLICIES
-- ============================================================
CREATE POLICY "Admins can read all issues"
  ON issues FOR SELECT
  USING (is_admin());

CREATE POLICY "Customers can read own issues"
  ON issues FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Engineers can read assigned issues"
  ON issues FOR SELECT
  USING (assigned_engineer_id = auth.uid());

CREATE POLICY "Customers can create issues"
  ON issues FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can update issues"
  ON issues FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Engineers can update assigned issues"
  ON issues FOR UPDATE
  USING (assigned_engineer_id = auth.uid())
  WITH CHECK (assigned_engineer_id = auth.uid());

-- ============================================================
-- ISSUE MEDIA POLICIES
-- ============================================================
CREATE POLICY "Admins can read all media"
  ON issue_media FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can read own issue media"
  ON issue_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = issue_media.issue_id
      AND (issues.customer_id = auth.uid() OR issues.assigned_engineer_id = auth.uid())
    )
  );

CREATE POLICY "Customers can upload media"
  ON issue_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = issue_media.issue_id
      AND issues.customer_id = auth.uid()
    )
  );

-- ============================================================
-- SERVICE REPORTS POLICIES
-- ============================================================
CREATE POLICY "Admins can read all reports"
  ON service_reports FOR SELECT
  USING (is_admin());

CREATE POLICY "Engineers can read own reports"
  ON service_reports FOR SELECT
  USING (engineer_id = auth.uid());

CREATE POLICY "Customers can read own machine reports"
  ON service_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines
      WHERE machines.id = service_reports.machine_id
      AND machines.owner_id = auth.uid()
    )
  );

CREATE POLICY "Engineers can create reports"
  ON service_reports FOR INSERT
  WITH CHECK (engineer_id = auth.uid());

-- ============================================================
-- MACHINE HISTORY POLICIES
-- ============================================================
CREATE POLICY "Admins can read all history"
  ON machine_history FOR SELECT
  USING (is_admin());

CREATE POLICY "Customers can read own machine history"
  ON machine_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM machines
      WHERE machines.id = machine_history.machine_id
      AND machines.owner_id = auth.uid()
    )
  );

CREATE POLICY "Engineers can read assigned machine history"
  ON machine_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM engineer_assignments
      WHERE engineer_assignments.machine_id = machine_history.machine_id
      AND engineer_assignments.engineer_id = auth.uid()
      AND engineer_assignments.status = 'approved'
    )
  );

-- ============================================================
-- ENGINEER ASSIGNMENTS POLICIES
-- ============================================================
CREATE POLICY "Admins can read all assignments"
  ON engineer_assignments FOR SELECT
  USING (is_admin());

CREATE POLICY "Engineers can read own assignments"
  ON engineer_assignments FOR SELECT
  USING (engineer_id = auth.uid());

CREATE POLICY "Customers can read own assignments"
  ON engineer_assignments FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Admins can manage assignments"
  ON engineer_assignments FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update assignments"
  ON engineer_assignments FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 12. STORAGE BUCKETS & POLICIES
-- ============================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('issue-media', 'issue-media', false),
  ('service-reports', 'service-reports', false),
  ('machine-docs', 'machine-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for issue-media bucket
CREATE POLICY "Customers can upload issue media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-media'
    AND EXISTS (
      SELECT 1 FROM issues
      WHERE issues.customer_id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can read issue media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'issue-media'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM issues
        WHERE issues.customer_id = auth.uid()
        OR issues.assigned_engineer_id = auth.uid()
      )
    )
  );

-- Storage policies for service-reports bucket
CREATE POLICY "Engineers and admins can upload reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'service-reports'
    AND (is_admin() OR get_user_role() = 'engineer')
  );

CREATE POLICY "Authorized users can read reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'service-reports'
    AND (
      is_admin()
      OR get_user_role() = 'engineer'
      OR get_user_role() = 'customer'
    )
  );

-- Storage policies for machine-docs bucket
CREATE POLICY "Admins can manage machine docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND is_admin()
  );

CREATE POLICY "Authenticated users can read machine docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'machine-docs'
    AND auth.role() = 'authenticated'
  );

-- ============================================================
-- 13. AUTO-INSERT MACHINE HISTORY TRIGGERS
-- ============================================================

-- When an issue is created
CREATE OR REPLACE FUNCTION log_issue_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO machine_history (machine_id, event_type, description, reference_id, created_by)
  VALUES (
    NEW.machine_id,
    'issue_raised',
    'Issue reported: ' || LEFT(NEW.description, 100),
    NEW.id,
    (SELECT name FROM user_profiles WHERE user_id = NEW.customer_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_issue_created
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION log_issue_creation();

-- When an issue is assigned
CREATE OR REPLACE FUNCTION log_engineer_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_engineer_id IS NOT NULL AND NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id THEN
    INSERT INTO machine_history (machine_id, event_type, description, reference_id, created_by)
    VALUES (
      NEW.machine_id,
      'engineer_assigned',
      'Engineer assigned to issue',
      NEW.id,
      (SELECT name FROM user_profiles WHERE user_id = NEW.assigned_engineer_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_issue_assigned
  AFTER UPDATE OF assigned_engineer_id ON issues
  FOR EACH ROW
  WHEN (NEW.assigned_engineer_id IS NOT NULL)
  EXECUTE FUNCTION log_engineer_assignment();
