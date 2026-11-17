'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Pencil,
  Trash2,
  X,
  Loader2,
  Calendar,
  Palette,
  Shirt,
  Sparkles,
  RefreshCw,
  Replace,
  RotateCcw,
  RotateCw,
  Eraser,
  Scissors,
  Undo2,
  ImagePlus,
  Layers,
  Droplets,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  ImageIcon,
  MoreHorizontal,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { SplitPhotoDialog } from '@/components/split-photo-dialog';
import { ApiError } from '@/lib/api';
import { useUpdateItem, useDeleteItem, useReanalyzeItem, useRotateImage, useRemoveBackground, useRestoreOriginal, useReplaceItemImage, useLogWear, useLogWash, useWashHistory, useItemWearStats, useItemWearHistory, useAddItemImage, useDeleteItemImage, useSetPrimaryImage } from '@/lib/hooks/use-items';
import { CLOTHING_SUBTYPES, Item } from '@/lib/types';
import {
  useClothingTypes,
  useClothingColors,
  useColorLabel,
  useFitLabel,
  useFormalityLabel,
  useMaterialLabel,
  useOccasionLabel,
  usePatternLabel,
  useSeasonLabel,
  useStyleLabel,
  useSubtypeLabel,
  useTypeLabel,
} from '@/lib/hooks/use-translated-constants';
import { ColorEyedropper } from '@/components/color-eyedropper';
import { ACCEPTED_IMAGE_INPUT } from '@/lib/image-types';
import { GeneratePairingsDialog } from '@/components/generate-pairings-dialog';
import { ItemTagsEditor } from '@/components/item-tags-editor';
import { ReplaceAnalysisDialog } from '@/components/replace-analysis-dialog';
import {
  diffTags,
  draftFromTags,
  primaryColorOfItem,
  subtypeAfterTypeChange,
  type ItemEdits,
  type TagDraft,
} from '@/lib/tag-edits';
import { useAiUiEnabled, useFeatures } from '@/lib/hooks/use-features';
import { useLocale, useTranslations } from 'next-intl';
import { ClosetDetails } from '@/components/wardrobe/closet-details';
import { CUSTOM_KIND_PREFIX, useCustomKinds } from '@/lib/hooks/use-wardrobe-categories';
import { formatDate } from '@/lib/utils';

interface ItemDetailDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Images now use signed URLs from backend (item.image_url, item.thumbnail_url)

interface EditForm {
  name: string;
  type: string;
  subtype: string;
  brand: string;
  primary_color: string;
  notes: string;
  favorite: boolean;
  wash_interval: number | undefined;
}

// The sign-in redirect handles these, as in the global error handler.
function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function isInvalidTagValue(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const data = error.data as { detail?: { error_code?: string } } | undefined;
  return data?.detail?.error_code === 'INVALID_TAG_VALUE';
}

function editFormFromItem(item: Item): EditForm {
  return {
    name: item.name || '',
    type: item.type,
    // Pre-fill a rejected AI type as the subtype so picking the nearest
    // supported type doesn't lose what the model actually saw.
    subtype: item.subtype || (item.type === 'unknown' && item.ai_unrecognized_type) || '',
    brand: item.brand || '',
    primary_color: primaryColorOfItem(item) || '',
    notes: item.notes || '',
    favorite: item.favorite,
    wash_interval: item.wash_interval ?? undefined,
  };
}

export function ItemDetailDialog({ item, open, onOpenChange }: ItemDetailDialogProps) {
  const typeLabel = useTypeLabel();
  const t = useTranslations('wardrobe.itemDetail');
  const tc = useTranslations('common');
  const tw = useTranslations('wardrobe');
  const locale = useLocale();
  const router = useRouter();
  const clothingTypes = useClothingTypes();
  const clothingColors = useClothingColors();
  const subtypeLabel = useSubtypeLabel();
  const { kinds: customKinds, resolve: resolveKind } = useCustomKinds();
  const materialLabel = useMaterialLabel();
  const occasionLabel = useOccasionLabel();
  const formalityLabel = useFormalityLabel();
  const colorLabel = useColorLabel();
  const patternLabel = usePatternLabel();
  const styleLabel = useStyleLabel();
  const seasonLabel = useSeasonLabel();
  const fitLabel = useFitLabel();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showPairingsDialog, setShowPairingsDialog] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    type: '',
    subtype: '',
    brand: '',
    primary_color: '',
    notes: '',
    favorite: false,
    wash_interval: undefined,
  });
  const [tagDraft, setTagDraft] = useState<TagDraft>(() =>
    draftFromTags(item?.tags ?? { colors: [], style: [], season: [] }, primaryColorOfItem(item)),
  );
  // The item as it was when editing began. Saving compares the form with this, not with the
  // item as it is now: tagging can finish while the form is open, and diffing against the fresh
  // item would send its new tags back as clears and resend untouched fields as edits.
  const [editBase, setEditBase] = useState<Item | null>(item);
  const [showWashHistory, setShowWashHistory] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [showWearHistory, setShowWearHistory] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const reanalyzeItem = useReanalyzeItem();
  const rotateImage = useRotateImage();
  const removeBackground = useRemoveBackground();
  const restoreOriginal = useRestoreOriginal();
  const replaceImage = useReplaceItemImage();
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const { data: features } = useFeatures();
  const aiUiEnabled = useAiUiEnabled();
  const logWear = useLogWear();
  const logWash = useLogWash();
  const { data: washHistory } = useWashHistory(item?.id || '');
  const { data: wearStats } = useItemWearStats(item?.id || '');
  const { data: wearHistory } = useItemWearHistory(item?.id || '', 20);
  const addImage = useAddItemImage();
  const deleteImage = useDeleteItemImage();
  const setPrimary = useSetPrimaryImage();

  useEffect(() => {
    if (item) {
      setEditForm(editFormFromItem(item));
      setTagDraft(draftFromTags(item.tags, primaryColorOfItem(item)));
      setEditBase(item);
      setIsEditing(false);
      setActiveImageIndex(0);
    }
  }, [item?.id]);

  if (!item) return null;

  const handleSave = async () => {
    const base = editBase ?? item;
    // Only what the person changed since editing began; an untouched field is not sent at all.
    const before: EditForm = { ...editFormFromItem(base), subtype: base.subtype || '' };
    const data: ItemEdits = {};
    if (editForm.name !== before.name) data.name = editForm.name || undefined;
    if (editForm.type !== before.type) data.type = editForm.type;
    const subtype = editForm.subtype.trim();
    // null (not undefined) so clearing the field actually clears it server-side.
    if (subtype !== before.subtype) data.subtype = subtype || null;
    if (editForm.brand !== before.brand) data.brand = editForm.brand || undefined;
    if (editForm.primary_color !== before.primary_color) {
      data.primary_color = editForm.primary_color || undefined;
    }
    if (editForm.notes !== before.notes) data.notes = editForm.notes || undefined;
    if (editForm.favorite !== before.favorite) data.favorite = editForm.favorite;
    if (editForm.wash_interval !== before.wash_interval) data.wash_interval = editForm.wash_interval;
    const tagChanges = diffTags(
      base.tags,
      tagDraft,
      editForm.primary_color || undefined,
      primaryColorOfItem(base),
    );
    if (Object.keys(tagChanges).length > 0) data.tags = tagChanges;

    if (Object.keys(data).length === 0) {
      setIsEditing(false);
      return;
    }
    try {
      await updateItem.mutateAsync({ id: item.id, data });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update item:', error);
      if (isUnauthorized(error)) return;
      toast.error(isInvalidTagValue(error) ? t('tagsEditor.invalidValue') : t('actions.saveError'));
    }
  };

  const handleLogWear = async () => {
    try {
      await logWear.mutateAsync({ id: item.id });
      toast.success(t('actions.wearLogged'));
    } catch (error) {
      console.error('Failed to log wear:', error);
      toast.error(t('actions.wearLogError'));
    }
  };

  const handleMarkWashed = async () => {
    try {
      await logWash.mutateAsync({ id: item.id });
      toast.success(t('actions.washed'));
    } catch (error) {
      console.error('Failed to log wash:', error);
      toast.error(t('actions.washError'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(item.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
      toast.success(t('actions.deleted'), {
        description: item.name ? t('actions.deletedWithName', { name: item.name }) : t('actions.deletedFallback'),
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(t('actions.deleteError'), {
        description: t('actions.deleteErrorDescription'),
      });
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: { favorite: !item.favorite },
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      if (!isUnauthorized(error)) toast.error(t('actions.saveError'));
    }
  };

  const handleReanalyze = async (replace = false) => {
    try {
      const result = await reanalyzeItem.mutateAsync({ id: item.id, replace });
      if (result.status === 'cooldown' && result.retry_after_seconds) {
        toast.info(tw('ai.retryCooldown', { seconds: result.retry_after_seconds }));
      } else if (replace && result.status === 'already_queued') {
        toast.info(t('replaceAnalysis.alreadyQueued'));
      }
      // Otherwise status will update to 'processing' and UI will reflect it
    } catch (error) {
      console.error('Failed to trigger re-analysis:', error);
    }
  };

  const handleRotate = async (direction: 'cw' | 'ccw') => {
    try {
      await rotateImage.mutateAsync({ id: item.id, direction });
      setImageKey((k) => k + 1);
      toast.success(t('actions.imageRotated'));
    } catch (error) {
      console.error('Failed to rotate image:', error);
      toast.error(t('actions.imageRotateError'));
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await removeBackground.mutateAsync({ id: item.id });
      setImageKey((k) => k + 1);
      toast.success(t('actions.backgroundRemoved'));
    } catch (error) {
      console.error('Failed to remove background:', error);
      toast.error(t('actions.backgroundRemoveError'));
    }
  };

  const handleRestoreOriginal = async () => {
    try {
      await restoreOriginal.mutateAsync(item.id);
      setImageKey((k) => k + 1);
      toast.success(t('actions.originalRestored'));
    } catch (error) {
      console.error('Failed to restore original image:', error);
      toast.error(t('actions.originalRestoreError'));
    }
  };

  const handleReplaceImage = async (file: File) => {
    try {
      await replaceImage.mutateAsync({ itemId: item.id, file });
      setImageKey((k) => k + 1);
      setActiveImageIndex(0);
      toast.success(t('actions.imageReplaced'));
    } catch (error) {
      console.error('Failed to replace image:', error);
      toast.error(t('actions.imageReplaceError'));
    }
  };

  const isAnalyzing = reanalyzeItem.isPending || item.status === 'processing';

  // Use signed URL from backend for better quality in detail view
  const imageUrl = item.image_url || item.image_path;
  const colorInfo = clothingColors.find((c) => c.value === item.primary_color);
  const typeInfo = clothingTypes.find((type) => type.value === item.type);
  const unrecognizedType = item.type === 'unknown' ? item.ai_unrecognized_type : null;
  const subtypeSuggestions = CLOTHING_SUBTYPES[editForm.type] ?? [];

  // AI-generated tags
  const tags = item.tags || {};
  const hasAiTags = !!(tags.colors?.length || tags.pattern || tags.material ||
                   tags.style?.length || tags.season?.length || tags.formality || tags.fit);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden [&>button]:hidden">
          {/* Header - sticky */}
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 p-4 border-b flex-shrink-0">
            {/* The name takes the room left by the buttons and is cut short if it runs out. */}
            <DialogTitle className="min-w-0 flex-1 truncate text-left text-xl">
              {item.name || (typeInfo ? typeInfo.label : item.type)}
            </DialogTitle>
            {/* A favourite heart, Edit, and everything else tucked behind one button: a row of a
                dozen bare icons did not fit a phone and said nothing about what each one did. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={updateItem.isPending}
                title={t('titles.toggleFavorite')}
              >
                <Heart
                  className={`h-5 w-5 ${
                    item.favorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                  }`}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                // While editing it is only a way out; the form's own buttons save or cancel.
                className={`h-10 gap-1.5 rounded-full ${isEditing ? 'w-10 px-0' : 'px-3.5'}`}
                aria-label={isEditing ? t('actions.cancelEditing') : undefined}
                title={isEditing ? t('actions.cancelEditing') : t('actions.editItem')}
                onClick={() => {
                  // Re-read the item on entering edit mode: tagging can finish while the
                  // dialog is open (same id, so the effect above doesn't re-run).
                  if (!isEditing) {
                    setEditForm(editFormFromItem(item));
                    setTagDraft(draftFromTags(item.tags, primaryColorOfItem(item)));
                    setEditBase(item);
                  }
                  setIsEditing(!isEditing);
                }}
              >
                {isEditing ? <X className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
                {!isEditing && t('closetEdit')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('moreActions')} title={t('moreActions')}>
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[15rem]">
                  {aiUiEnabled && (
                    <>
                      <DropdownMenuItem title={t('titles.suggestOutfit')}
                        disabled={item.status !== 'ready'}
                        onSelect={() => {
                          onOpenChange(false);
                          router.push(`/dashboard/suggest?item=${item.id}`);
                        }}
                      >
                        <Sparkles className="mr-2 h-4 w-4 text-primary" />
                        {t('titles.suggestOutfit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem title={t('titles.findMatchingOutfits')}
                        disabled={item.status !== 'ready'}
                        onSelect={() => setShowPairingsDialog(true)}
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        {t('titles.findMatchingOutfits')}
                      </DropdownMenuItem>
                      <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                    </>
                  )}
                  <DropdownMenuItem title={t('titles.rotateLeft')} disabled={rotateImage.isPending} onSelect={() => handleRotate('ccw')}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('titles.rotateLeft')}
                  </DropdownMenuItem>
                  <DropdownMenuItem title={t('titles.rotateRight')} disabled={rotateImage.isPending} onSelect={() => handleRotate('cw')}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    {t('titles.rotateRight')}
                  </DropdownMenuItem>
                  {features?.background_removal && !item.original_image_path && (
                    <DropdownMenuItem title={t('titles.removeBackground')}
                      disabled={removeBackground.isPending || !item.image_url}
                      onSelect={handleRemoveBackground}
                    >
                      <Eraser className="mr-2 h-4 w-4" />
                      {t('titles.removeBackground')}
                    </DropdownMenuItem>
                  )}
                  {item.original_image_path && (
                    <DropdownMenuItem title={t('titles.undoBackgroundRemoval')} disabled={restoreOriginal.isPending} onSelect={handleRestoreOriginal}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      {t('titles.undoBackgroundRemoval')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem title={t('titles.replaceImage')}
                    disabled={replaceImage.isPending}
                    onSelect={() => replaceImageInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {t('titles.replaceImage')}
                  </DropdownMenuItem>
                  {item.image_url && (
                    <DropdownMenuItem title={t('titles.splitPhoto')} onSelect={() => setShowSplit(true)}>
                      <Scissors className="mr-2 h-4 w-4" />
                      {t('titles.splitPhoto')}
                    </DropdownMenuItem>
                  )}
                  {aiUiEnabled && (
                    <>
                      <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                      <DropdownMenuItem
                        title={isAnalyzing ? t('titles.analysisInProgress') : t('titles.reanalyzeWithAI')}
                        disabled={isAnalyzing}
                        onSelect={() => handleReanalyze()}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? 'animate-spin text-primary' : ''}`} />
                        {isAnalyzing ? t('titles.analysisInProgress') : t('titles.reanalyzeWithAI')}
                      </DropdownMenuItem>
                      <DropdownMenuItem title={t('titles.reanalyzeAndReplace')} disabled={isAnalyzing} onSelect={() => setShowReplaceConfirm(true)}>
                        <Replace className="mr-2 h-4 w-4" />
                        {t('titles.reanalyzeAndReplace')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={replaceImageInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_INPUT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleReplaceImage(file);
                  }
                  e.target.value = '';
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full flex-shrink-0"
              title={tc('close')}
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-6 pt-4">
            <div className="grid gap-6 sm:grid-cols-2 [&>*]:min-w-0">
            {/* Image Gallery */}
            <div className="space-y-2">
              <div className="photo-ground relative aspect-square rounded-lg overflow-hidden">
                {(() => {
                  const allImages = [
                    { url: `${imageUrl}&v=${imageKey}`, id: 'primary' },
                    ...(item.additional_images || []).map((img) => ({ url: img.image_url, id: img.id })),
                  ];
                  const currentImage = allImages[activeImageIndex] || allImages[0];
                  return (
                    <>
                      <Image
                        key={`${currentImage.id}-${imageKey}`}
                        src={currentImage.url}
                        alt={item.name || typeLabel(item.type)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      {allImages.length > 1 && (
                        <>
                          <button
                            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                            onClick={() => setActiveImageIndex((i) => (i - 1 + allImages.length) % allImages.length)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                            onClick={() => setActiveImageIndex((i) => (i + 1) % allImages.length)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {allImages.map((_, idx) => (
                              <button
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${idx === activeImageIndex ? 'bg-white' : 'bg-white/50'}`}
                                onClick={() => setActiveImageIndex(idx)}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">{t('view.aiAnalyzing')}</span>
                  </div>
                )}
              </div>
              {/* Thumbnail strip */}
              {(item.additional_images?.length > 0 || isEditing) && (
                <div className="flex gap-1.5 overflow-x-auto">
                  <button
                    className={`relative w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 ${activeImageIndex === 0 ? 'border-primary' : 'border-transparent'}`}
                    onClick={() => setActiveImageIndex(0)}
                  >
                    <Image src={imageUrl} alt={t('view.primaryImage')} fill className="object-cover" sizes="48px" />
                  </button>
                  {(item.additional_images || []).map((img, idx) => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <button
                        className={`relative w-12 h-12 rounded border-2 overflow-hidden ${activeImageIndex === idx + 1 ? 'border-primary' : 'border-transparent'}`}
                        onClick={() => setActiveImageIndex(idx + 1)}
                      >
                        <Image src={img.thumbnail_url || img.image_url} alt="" fill className="object-cover" sizes="48px" />
                      </button>
                      {isEditing && (
                        <div className="absolute -top-1 -right-1 flex gap-0.5">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-0.5 hover:bg-primary/90"
                            title={t('titles.setAsPrimary')}
                            onClick={() => {
                              setPrimary.mutate({ itemId: item.id, imageId: img.id });
                              setActiveImageIndex(0);
                            }}
                          >
                            <Star className="h-2.5 w-2.5" />
                          </button>
                          <button
                            className="bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
                            title={t('titles.deleteImage')}
                            onClick={() => {
                              deleteImage.mutate({ itemId: item.id, imageId: img.id });
                              if (activeImageIndex > idx) setActiveImageIndex((i) => i - 1);
                            }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (item.additional_images?.length || 0) < 4 && (
                    <label
                      className="w-12 h-12 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 flex-shrink-0"
                    >
                      {addImage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_INPUT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            addImage.mutate({ itemId: item.id, file });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4">
              {isEditing ? (
                // Edit form
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('name')}</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder={t('placeholders.itemName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('type')}</Label>
                    {unrecognizedType && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {t('unrecognizedType', { value: unrecognizedType })}
                      </p>
                    )}
                    <Select
                      value={editForm.type}
                      onValueChange={(v) => {
                        // One of the person's own kinds fills in both the type and the subtype.
                        const chosen = resolveKind(v);
                        if (!chosen.type) return;
                        setEditForm({
                          ...editForm,
                          type: chosen.type,
                          subtype: chosen.subtype ?? subtypeAfterTypeChange(chosen.type, editForm.subtype),
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {customKinds.map((kind) => (
                          <SelectItem key={kind.id} value={CUSTOM_KIND_PREFIX + kind.id}>
                            {kind.name}
                          </SelectItem>
                        ))}
                        {clothingTypes.map((ct) => (
                          <SelectItem key={ct.value} value={ct.value}>
                            {ct.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-subtype">{t('subtype')}</Label>
                    <Input
                      id="item-subtype"
                      list="item-subtype-suggestions"
                      maxLength={50}
                      value={editForm.subtype}
                      onChange={(e) => setEditForm({ ...editForm, subtype: e.target.value })}
                      placeholder={t('placeholders.subtype')}
                    />
                    <datalist id="item-subtype-suggestions">
                      {customKinds
                        .filter((kind) => kind.base_type === editForm.type)
                        .map((kind) => (
                          <option key={kind.id} value={kind.name} />
                        ))}
                      {subtypeSuggestions.map((st) => (
                        <option key={st} value={st}>{subtypeLabel(st)}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('brand')}</Label>
                    <Input
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      placeholder={t('placeholders.brandName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('primaryColor')}</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editForm.primary_color}
                        onValueChange={(v) => setEditForm({ ...editForm, primary_color: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t('placeholders.selectColor')} />
                        </SelectTrigger>
                        <SelectContent>
                          {clothingColors.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: c.hex }}
                                />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ColorEyedropper
                        imageUrl={imageUrl}
                        onColorSelect={(color) => setEditForm({ ...editForm, primary_color: color })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('notes')}</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder={t('placeholders.additionalNotes')}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('washInterval')} ({t('view.wears')})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={editForm.wash_interval ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, wash_interval: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder={t('placeholders.washIntervalDefault', { count: item.effective_wash_interval })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('view.washIntervalHint')}
                    </p>
                  </div>
                  <ItemTagsEditor
                    draft={tagDraft}
                    onChange={setTagDraft}
                    primaryColor={editForm.primary_color || undefined}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditing(false)}
                    >
                      {tc('cancel')}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSave}
                      disabled={updateItem.isPending}
                    >
                      {updateItem.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {tc('save')}
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-4">
                  {/* What it is, its colour and how often it is worn, on one line under the name. */}
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                      {colorInfo && (
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 rounded-full border"
                          style={{ backgroundColor: colorInfo.hex }}
                        />
                      )}
                      <span className="font-medium text-foreground">{typeInfo ? typeInfo.label : item.type}</span>
                      {item.subtype && <span>· {subtypeLabel(item.subtype)}</span>}
                      {colorInfo && <span>· {colorInfo.name}</span>}
                      {item.wear_count > 0 && <span>· {t('view.wornCount', { count: item.wear_count })}</span>}
                    </p>
                    {unrecognizedType && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {t('unrecognizedType', { value: unrecognizedType })}
                      </p>
                    )}
                  </div>

                  <ClosetDetails key={item.id} item={item} />

                  {/* Wash Status */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('view.washStatus')}</h3>
                    <div className="rounded-2xl border bg-card p-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="h-11 gap-1.5"
                          onClick={handleLogWear}
                          disabled={logWear.isPending}
                        >
                          {logWear.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Shirt className="h-4 w-4" />
                          )}
                          {t('actions.logWear')}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 gap-1.5"
                          onClick={handleMarkWashed}
                          disabled={logWash.isPending}
                        >
                          {logWash.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Droplets className="h-4 w-4" />
                          )}
                          {t('actions.markWashed')}
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t('view.wearsSinceWash', { current: item.wears_since_wash, max: item.effective_wash_interval })}</span>
                        {item.needs_wash && (
                          <span className="text-amber-500 font-medium">{t('view.needsWashing')}</span>
                        )}
                      </div>
                      <Progress
                        value={Math.min((item.wears_since_wash / item.effective_wash_interval) * 100, 100)}
                        className={`h-2 ${item.needs_wash ? '[&>div]:bg-amber-500' : ''}`}
                      />
                      {item.last_washed_at && (
                        <p className="text-xs text-muted-foreground">
                          {t('view.lastWashed', { date: formatDate(item.last_washed_at, locale) })}
                        </p>
                      )}
                    </div>

                    {/* Wash History */}
                    {washHistory && washHistory.length > 0 && (
                      <Collapsible open={showWashHistory} onOpenChange={setShowWashHistory}>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className={`h-3 w-3 transition-transform ${showWashHistory ? 'rotate-180' : ''}`} />
                          {t('view.washHistory', { count: washHistory.length })}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1.5 space-y-1">
                          {washHistory.map((wash) => (
                            <div key={wash.id} className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{formatDate(wash.washed_at, locale)}</span>
                              {wash.method && <Badge variant="outline" className="text-[10px] h-4">{wash.method}</Badge>}
                              {wash.notes && <span className="truncate">{wash.notes}</span>}
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    </div>
                  </section>

                  {/* Wear History */}
                  {item.wear_count > 0 && wearStats && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('view.wearHistory')}</h3>
                      <div className="rounded-2xl border bg-card p-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-muted/60 p-2.5">
                          <p className="text-muted-foreground">{t('view.totalWears')}</p>
                          <p className="font-medium text-sm">{wearStats.total_wears}</p>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-2.5">
                          <p className="text-muted-foreground">{t('view.lastWorn')}</p>
                          <p className="font-medium text-sm">
                            {wearStats.days_since_last_worn === null
                              ? t('view.never')
                              : wearStats.days_since_last_worn === 0
                              ? t('view.today')
                              : t('view.daysAgo', { count: wearStats.days_since_last_worn })}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-2.5">
                          <p className="text-muted-foreground">{t('view.avgPerMonth')}</p>
                          <p className="font-medium text-sm">{wearStats.average_wears_per_month}</p>
                        </div>
                        {wearStats.most_common_occasion && (
                          <div className="rounded-xl bg-muted/60 p-2.5">
                            <p className="text-muted-foreground">{t('view.usualOccasion')}</p>
                            <p className="font-medium text-sm">{occasionLabel(wearStats.most_common_occasion)}</p>
                          </div>
                        )}
                      </div>

                      {/* Mini bar chart - wear by month */}
                      {Object.keys(wearStats.wear_by_month).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{t('view.last6Months')}</p>
                          <div className="flex items-end gap-1 h-12">
                            {Object.entries(wearStats.wear_by_month).map(([month, count]) => {
                              const maxCount = Math.max(...Object.values(wearStats.wear_by_month), 1);
                              const height = (count / maxCount) * 100;
                              return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-0.5" title={t('view.monthWears', { month, count })}>
                                  <div
                                    className="w-full bg-primary/70 rounded-t-sm min-h-[2px]"
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                  />
                                  <span className="text-[9px] text-muted-foreground">{month.split('-')[1]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Wear timeline */}
                      {wearHistory && wearHistory.length > 0 && (
                        <Collapsible open={showWearHistory} onOpenChange={setShowWearHistory}>
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className={`h-3 w-3 transition-transform ${showWearHistory ? 'rotate-180' : ''}`} />
                            {t('view.timeline', { count: wearHistory.length })}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1.5 space-y-1.5">
                            {wearHistory.map((entry) => (
                              <div key={entry.id} className="text-xs flex items-start gap-2">
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {formatDate(entry.worn_at, locale)}
                                </span>
                                {entry.occasion && (
                                  <Badge variant="outline" className="text-[10px] h-4">{occasionLabel(entry.occasion)}</Badge>
                                )}
                                {entry.outfit && (
                                  <div className="flex -space-x-1">
                                    {entry.outfit.items.slice(0, 3).map((oi) => (
                                      <div
                                        key={oi.id}
                                        className="w-5 h-5 rounded-full bg-muted border-2 border-background overflow-hidden"
                                        title={oi.name || typeLabel(oi.type)}
                                      >
                                        {oi.thumbnail_url && (
                                          <Image
                                            src={oi.thumbnail_url}
                                            alt={oi.name || typeLabel(oi.type)}
                                            width={20}
                                            height={20}
                                            className="object-cover w-full h-full"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      </div>
                    </section>
                  )}

                  {/* AI Analysis */}
                  {(hasAiTags || item.ai_description) && item.status === 'ready' && (
                    <section className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('view.aiAnalysis')}</h3>
                        {item.ai_confidence !== undefined && item.ai_confidence > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {t('view.complete', { percent: Math.round(item.ai_confidence * 100) })}
                          </Badge>
                        )}
                        {item.tags?.logprobs_confidence != null && (
                          <Badge variant="outline" className="text-xs">
                            {t('view.confident', { percent: Math.round(item.tags.logprobs_confidence * 100) })}
                          </Badge>
                        )}
                      </div>
                      <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                      {item.ai_description && (
                        <p className="text-sm text-muted-foreground italic">
                          &ldquo;{item.ai_description}&rdquo;
                        </p>
                      )}
                      {hasAiTags && <div className="flex flex-wrap gap-1.5">
                        {tags.colors?.map((color) => (
                          <Badge key={color} variant="outline" className="text-xs">
                            {colorLabel(color)}
                          </Badge>
                        ))}
                        {tags.pattern && (
                          <Badge variant="outline" className="text-xs">
                            {patternLabel(tags.pattern)}
                          </Badge>
                        )}
                        {tags.material && (
                          <Badge variant="outline" className="text-xs">
                            {materialLabel(tags.material)}
                          </Badge>
                        )}
                        {tags.style?.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {styleLabel(s)}
                          </Badge>
                        ))}
                        {tags.season?.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {seasonLabel(s)}
                          </Badge>
                        ))}
                        {tags.formality && (
                          <Badge variant="outline" className="text-xs">
                            {formalityLabel(tags.formality)}
                          </Badge>
                        )}
                        {tags.fit && (
                          <Badge variant="outline" className="text-xs">
                            {t('view.fitBadge', { fit: fitLabel(tags.fit) })}
                          </Badge>
                        )}
                      </div>}
                      </div>
                    </section>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('notes')}</h3>
                      <p className="rounded-2xl border bg-card p-3.5 text-[15px]">{item.notes}</p>
                    </section>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    {t('view.addedDate', { date: formatDate(item.created_at, locale) })}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Delete button - separated from other actions for safety */}
            {!isEditing && (
              <div className="pt-4 border-t mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('actions.deleteItem')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showSplit && item.image_url && (
        <SplitPhotoDialog
          itemId={item.id}
          imageUrl={item.medium_url ?? item.image_url}
          open
          onClose={() => setShowSplit(false)}
          onDone={() => onOpenChange(false)}
        />
      )}

      <ReplaceAnalysisDialog
        open={showReplaceConfirm}
        onOpenChange={setShowReplaceConfirm}
        onConfirm={() => handleReanalyze(true)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.deleteDescription', { name: item.name || typeLabel(item.type) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {aiUiEnabled && (
        <GeneratePairingsDialog
          item={item}
          open={showPairingsDialog}
          onOpenChange={setShowPairingsDialog}
        />
      )}
    </>
  );
}
