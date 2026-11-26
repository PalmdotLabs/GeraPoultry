export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          id: number;
          metadata: NonNullable<Json>;
          occurred_at: string;
          request_id: string | null;
          target_id: string;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          request_id?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          request_id?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      breeds: {
        Row: {
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      egg_collections: {
        Row: {
          collection_date: string;
          cracked_egg_count: number;
          created_by: string;
          dirty_egg_count: number;
          flock_id: string | null;
          good_egg_count: number;
          grade_id: string;
          id: string;
          shed_id: string;
          shift: string;
          submission_id: string;
          total_egg_count: number | null;
        };
        ComputedFields: never;
        Insert: {
          collection_date: string;
          cracked_egg_count: number;
          created_by: string;
          dirty_egg_count: number;
          flock_id?: string | null;
          good_egg_count: number;
          grade_id: string;
          id?: string;
          shed_id: string;
          shift: string;
          submission_id: string;
          total_egg_count?: never;
        };
        Update: {
          collection_date?: string;
          cracked_egg_count?: number;
          created_by?: string;
          dirty_egg_count?: number;
          flock_id?: string | null;
          good_egg_count?: number;
          grade_id?: string;
          id?: string;
          shed_id?: string;
          shift?: string;
          submission_id?: string;
          total_egg_count?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'egg_collections_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'egg_collections_flock_id_shed_id_fkey';
            columns: ['flock_id', 'shed_id'];
            isOneToOne: false;
            referencedRelation: 'flock_placements';
            referencedColumns: ['flock_id', 'shed_id'];
          },
          {
            foreignKeyName: 'egg_collections_grade_id_fkey';
            columns: ['grade_id'];
            isOneToOne: false;
            referencedRelation: 'egg_grades';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'egg_collections_shed_id_fkey';
            columns: ['shed_id'];
            isOneToOne: false;
            referencedRelation: 'sheds';
            referencedColumns: ['id'];
          },
        ];
      };
      egg_grades: {
        Row: {
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      flock_mortality: {
        Row: {
          bird_count: number;
          created_at: string;
          created_by: string;
          flock_id: string;
          id: string;
          recorded_date: string;
          remarks: string | null;
          shed_id: string;
          submission_id: string;
        };
        ComputedFields: never;
        Insert: {
          bird_count: number;
          created_at?: string;
          created_by: string;
          flock_id: string;
          id?: string;
          recorded_date: string;
          remarks?: string | null;
          shed_id: string;
          submission_id: string;
        };
        Update: {
          bird_count?: number;
          created_at?: string;
          created_by?: string;
          flock_id?: string;
          id?: string;
          recorded_date?: string;
          remarks?: string | null;
          shed_id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'flock_mortality_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'flock_mortality_flock_id_shed_id_fkey';
            columns: ['flock_id', 'shed_id'];
            isOneToOne: false;
            referencedRelation: 'flock_placements';
            referencedColumns: ['flock_id', 'shed_id'];
          },
        ];
      };
      flock_placements: {
        Row: {
          bird_count: number;
          flock_id: string;
          live_bird_count: number;
          shed_id: string;
        };
        ComputedFields: never;
        Insert: {
          bird_count: number;
          flock_id: string;
          live_bird_count: number;
          shed_id: string;
        };
        Update: {
          bird_count?: number;
          flock_id?: string;
          live_bird_count?: number;
          shed_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'flock_placements_flock_id_fkey';
            columns: ['flock_id'];
            isOneToOne: false;
            referencedRelation: 'flocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'flock_placements_shed_id_fkey';
            columns: ['shed_id'];
            isOneToOne: false;
            referencedRelation: 'sheds';
            referencedColumns: ['id'];
          },
        ];
      };
      flocks: {
        Row: {
          age_at_arrival: number;
          age_unit: string;
          arrival_date: string;
          batch_code: string;
          birds_housed: number;
          breed_id: string;
          created_by: string;
          id: string;
          submission_id: string;
        };
        ComputedFields: never;
        Insert: {
          age_at_arrival: number;
          age_unit: string;
          arrival_date: string;
          batch_code: string;
          birds_housed: number;
          breed_id: string;
          created_by: string;
          id?: string;
          submission_id: string;
        };
        Update: {
          age_at_arrival?: number;
          age_unit?: string;
          arrival_date?: string;
          batch_code?: string;
          birds_housed?: number;
          breed_id?: string;
          created_by?: string;
          id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'flocks_breed_id_fkey';
            columns: ['breed_id'];
            isOneToOne: false;
            referencedRelation: 'breeds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'flocks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      permissions: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          permission_id: string;
          role_id: string;
        };
        ComputedFields: never;
        Insert: {
          permission_id: string;
          role_id: string;
        };
        Update: {
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_permission_id_fkey';
            columns: ['permission_id'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      roles: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
          is_system: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_system?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sheds: {
        Row: {
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          role_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          role_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      active_permissions: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      admin_delete_role: { Args: { p_role_id: string }; Returns: undefined };
      admin_record_user_invite: {
        Args: {
          p_request_id: string;
          p_target_email: string;
          p_target_user_id: string;
        };
        Returns: undefined;
      };
      admin_set_user_active: {
        Args: { p_is_active: boolean; p_target_user_id: string };
        Returns: undefined;
      };
      admin_set_user_roles: {
        Args: { p_role_ids: string[]; p_target_user_id: string };
        Returns: undefined;
      };
      admin_upsert_role: {
        Args: {
          p_code: string;
          p_description: string;
          p_name: string;
          p_permission_ids: string[];
          p_role_id: string;
        };
        Returns: string;
      };
      administrative_auth_users_page: {
        Args: { p_limit: number; p_offset: number };
        Returns: Json;
      };
      assert_active_admin_permission: {
        Args: { p_permission_code: string };
        Returns: undefined;
      };
      assert_active_admin_remains: {
        Args: { error_message: string };
        Returns: undefined;
      };
      get_assigned_role_summaries: {
        Args: { p_user_ids: string[] };
        Returns: {
          role_code: string;
          role_id: string;
          role_name: string;
          user_id: string;
        }[];
      };
      get_session_context: { Args: Record<PropertyKey, never>; Returns: Json };
      has_permission: { Args: { permission_code: string }; Returns: boolean };
      is_active_authoritative_admin: {
        Args: { candidate_is_active: boolean; candidate_user_id: string };
        Returns: boolean;
      };
      is_authoritative_admin_role: {
        Args: { candidate_role_id: string };
        Returns: boolean;
      };
      record_egg_collection: {
        Args: {
          p_collection_date: string;
          p_cracked_egg_count: number;
          p_dirty_egg_count: number;
          p_flock_id?: string;
          p_good_egg_count: number;
          p_grade_id: string;
          p_request_id: string;
          p_shed_id: string;
          p_shift: string;
          p_submission_id: string;
        };
        Returns: string;
      };
      record_flock_mortality: {
        Args: {
          p_bird_count: number;
          p_flock_id: string;
          p_recorded_date: string;
          p_remarks: string;
          p_request_id: string;
          p_shed_id: string;
          p_submission_id: string;
        };
        Returns: string;
      };
      register_flock: {
        Args: {
          p_age_at_arrival: number;
          p_age_unit: string;
          p_arrival_date: string;
          p_batch_code: string;
          p_birds_housed: number;
          p_breed_id: string;
          p_placements: Json;
          p_request_id: string;
          p_submission_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
