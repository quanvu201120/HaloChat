import React from 'react';
import type { UseFormRegister, UseFormHandleSubmit, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { UserCircle, Save, Phone, MapPin, Mail, Edit2, Calendar, Users, FileText, ChevronDown, Check } from 'lucide-react';
import type { ProfileFormValues } from './ProfilePage.helpers';

type ProfileEditFormProps = {
  register: UseFormRegister<ProfileFormValues>;
  handleSubmit: UseFormHandleSubmit<ProfileFormValues>;
  watch: UseFormWatch<ProfileFormValues>;
  setValue: UseFormSetValue<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
  onSubmit: (data: ProfileFormValues) => Promise<void>;
  isLoading: boolean;
  setIsUpdateEmailModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isGenderSelectOpen: boolean;
  setIsGenderSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  genderSelectRef: React.RefObject<HTMLDivElement | null>;
  userEmail: string;
};

export default function ProfileEditForm({
  register,
  handleSubmit,
  watch,
  setValue,
  errors,
  onSubmit,
  isLoading,
  setIsUpdateEmailModalOpen,
  isGenderSelectOpen,
  setIsGenderSelectOpen,
  genderSelectRef,
  userEmail,
}: ProfileEditFormProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
          background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UserCircle size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Chỉnh sửa hồ sơ</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thông tin có thể thay đổi</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-bio" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={13} /> Tiểu sử
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {(watch('bio') || '').length}/250
            </span>
          </label>
          <textarea
            id="profile-bio"
            className={`form-input ${errors.bio ? 'is-invalid' : ''}`}
            placeholder="Giới thiệu đôi nét về bạn..."
            rows={3}
            maxLength={250}
            {...register('bio')}
          />
          {errors.bio && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.bio.message}</div>}
        </div>
        {/* Email readonly */}
        <div className="form-group">
          <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Mail size={13} /> Email
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', background: 'transparent', border: '1px solid var(--border)' }}
              onClick={() => setIsUpdateEmailModalOpen(true)}
            >
              <Edit2 size={12} style={{ marginRight: '4px' }} /> Cập nhật
            </button>
          </div>
          <input
            className="form-input"
            value={userEmail || ''}
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="profile-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <UserCircle size={13} /> Tên hiển thị
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                {(watch('name') || '').length}/50
              </span>
            </label>
            <input
              id="profile-name"
              className={`form-input ${errors.name ? 'is-invalid' : ''}`}
              placeholder="VD: Nguyễn Văn A"
              maxLength={50}
              {...register('name')}
            />

            {errors.name && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.name.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-phone">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Phone size={13} /> Số điện thoại
              </span>
            </label>
            <input
              id="profile-phone"
              className={`form-input ${errors.phone ? 'is-invalid' : ''}`}
              placeholder="VD: 0912345678"
              {...register('phone')}
            />

            {errors.phone && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.phone.message}</div>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="profile-address" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={13} /> Địa chỉ
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {(watch('address') || '').length}/150
            </span>
          </label>
          <input
            id="profile-address"
            className={`form-input ${errors.address ? 'is-invalid' : ''}`}
            placeholder="VD: TP. Hồ Chí Minh"
            maxLength={150}
            {...register('address')}
          />

          {errors.address && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.address.message}</div>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="profile-dob">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} /> Ngày sinh
              </span>
            </label>
            <input
              id="profile-dob"
              type="date"
              className={`form-input ${errors.dateOfBirth ? 'is-invalid' : ''}`}
              {...register('dateOfBirth')}
            />
            {errors.dateOfBirth && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.dateOfBirth.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-gender">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Users size={13} /> Giới tính
              </span>
            </label>
            <div style={{ position: 'relative' }} ref={genderSelectRef}>
              <button
                type="button"
                className={`form-input ${errors.gender ? 'is-invalid' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: 'transparent', width: '100%', height: '42px', padding: '0 16px' }}
                onClick={(e) => { e.stopPropagation(); setIsGenderSelectOpen(!isGenderSelectOpen); }}
              >
                <span>
                  {watch('gender') === 'MALE' ? 'Nam' : watch('gender') === 'FEMALE' ? 'Nữ' : watch('gender') === 'OTHER' ? 'Khác' : 'Chọn giới tính'}
                </span>
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
              {isGenderSelectOpen && (
                <div
                  style={{
                    position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px',
                    backgroundColor: 'var(--bg-card)', borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 50,
                    border: '1px solid var(--border)', padding: '4px 0',
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                >
                  {[
                    { value: '', label: 'Chọn giới tính' },
                    { value: 'MALE', label: 'Nam' },
                    { value: 'FEMALE', label: 'Nữ' },
                    { value: 'OTHER', label: 'Khác' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="dropdown-item custom-dropdown-btn hover:bg-[var(--bg-secondary)] transition-colors duration-200"
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 16px',
                        fontSize: '14px', border: 'none',
                        cursor: 'pointer', color: watch('gender') === opt.value ? 'var(--accent-primary)' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                      onClick={() => {
                        setValue('gender', opt.value, { shouldDirty: true });
                        setIsGenderSelectOpen(false);
                      }}
                    >
                      {opt.label}
                      {watch('gender') === opt.value && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.gender && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.gender.message}</div>}
          </div>
        </div>



        <button
          id="btn-save-profile"
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
        >
          {isLoading ? (
            <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
          ) : (
            <><Save size={15} /> Lưu thay đổi</>
          )}
        </button>
      </form>
    </div>
  );
}
