export class CreateLeavePolicyDto {
  name: string;
  workingDaysPerWeek?: number = 5;
  publicHolidaysPerYear?: number = 0;
  entitlementDays: number;
}
