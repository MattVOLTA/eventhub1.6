import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

interface InterestFilterProps {
  interests: Array<{ id: number; name: string }>;
  selectedInterests: number[];
  onChange: (selectedIds: number[]) => void;
}

export function InterestFilter({ interests, selectedInterests, onChange }: InterestFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleInterestClick = (id: number) => {
    if (selectedInterests.includes(id)) {
      onChange(selectedInterests.filter(interestId => interestId !== id));
    } else {
      onChange([...selectedInterests, id]);
    }
  };

  const handleSelectAllClick = () => {
    const allSelected = selectedInterests.length === interests.length;
    onChange(allSelected ? [] : interests.map(interest => interest.id));
  };

  const getButtonText = () => {
    if (selectedInterests.length === 0) return 'No Interests Selected';
    if (selectedInterests.length === interests.length) return 'All Interests';
    return `${selectedInterests.length} Interest${selectedInterests.length === 1 ? '' : 's'}`;
  };

  // Sort interests alphabetically by name
  const sortedInterests = [...interests].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
      >
        <span className="mr-2">{getButtonText()}</span>
        <ChevronsUpDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-full bg-white rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
            <button
              type="button"
              onClick={handleSelectAllClick}
              className="w-full px-2 py-1 hover:bg-gray-100 cursor-pointer flex items-center"
            >
              <div className="w-5 h-5 border rounded mr-2 flex items-center justify-center">
                {selectedInterests.length === interests.length && (
                  <Check className="h-4 w-4 text-[#F1B434]" />
                )}
              </div>
              <span className="text-gray-900">Select All</span>
            </button>
            
            <div className="h-px bg-gray-200 my-1" />
            
            {sortedInterests.map((interest) => (
              <button
                key={`interest-${interest.id}`}
                type="button"
                onClick={() => handleInterestClick(interest.id)}
                className="w-full px-2 py-1 hover:bg-gray-100 cursor-pointer flex items-center"
              >
                <div className="w-5 h-5 border rounded mr-2 flex items-center justify-center">
                  {selectedInterests.includes(interest.id) && (
                    <Check className="h-4 w-4 text-[#F1B434]" />
                  )}
                </div>
                <span className="text-gray-900">{interest.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}